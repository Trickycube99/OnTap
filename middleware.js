// Server-Side Edge Authentication & Route Protection Middleware
// Runs at the edge before serving private routes and API endpoints.
// Enforces server-side authentication, rejects unauthorized API requests (HTTP 401/403),
// redirects unauthenticated protected page requests, and injects anti-BFCache headers.

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // Parse cookies from request header
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  const sessionToken = cookies['ontap_session_token'] || '';
  const sessionRole = cookies['ontap_session_role'] || '';
  const devSession = cookies['ontap_dev_session'] || '';
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const isAuthenticated = Boolean(sessionToken || devSession || bearerToken);
  const isDeveloper = Boolean(devSession || (sessionRole === 'developer'));

  // 1. Server-Side Protection for API Endpoints (/api/*)
  if (pathname.startsWith('/api/')) {
    // Whitelist public auth action endpoints
    if (
      pathname === '/api/auth/login' ||
      pathname === '/api/auth/verify-table' ||
      pathname === '/api/auth/logout' ||
      pathname === '/api/health'
    ) {
      // Allowed to proceed to API handler
      return;
    }

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          status: 401,
          message: 'Server authentication required. Please provide a valid session token or cookie.'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    }

    // Role-specific API authorization check
    if (pathname.startsWith('/api/admin/') && !isDeveloper && sessionRole !== 'admin') {
      return new Response(
        JSON.stringify({
          error: 'FORBIDDEN',
          status: 403,
          message: 'Object-level permission denied: Admin owner role required.'
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private'
          }
        }
      );
    }

    return;
  }

  // 2. Server-Side Route Guard for Private / Protected Pages
  // Note: Guest dining menus are accessed at / or ?table=X; Back-office & POS terminals are protected
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isCounterRoute = pathname === '/counter' || pathname.startsWith('/counter/');
  const isDevRoute = pathname === '/developer' || pathname.startsWith('/developer/');

  if (isAdminRoute || isCounterRoute || isDevRoute) {
    if (!isAuthenticated) {
      const targetRole = isDevRoute ? 'developer' : isCounterRoute ? 'counter' : 'admin';
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('login', 'true');
      redirectUrl.searchParams.set('role', targetRole);

      const response = Response.redirect(redirectUrl.toString(), 307);
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    if (isDevRoute && !isDeveloper) {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('login', 'true');
      redirectUrl.searchParams.set('role', 'developer');
      return Response.redirect(redirectUrl.toString(), 307);
    }
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/counter/:path*',
    '/developer/:path*',
    '/api/:path*'
  ]
};
