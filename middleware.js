// Server-Side Edge Authentication, Rate Limiting, CORS & Route Protection Middleware
// Runs at the edge before serving private routes and API endpoints.

const ALLOWED_ORIGINS = [
  'https://restraunt-web-app.vercel.app',
  'https://ontap.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173'
];

// Edge Rate Limiting Map (IP-based, 60 requests/minute for APIs)
const ipRateLimitMap = new Map();

function checkIpRateLimit(ip, limit = 60, windowMs = 60000) {
  if (!ip) return true;
  const now = Date.now();
  let record = ipRateLimitMap.get(ip);
  if (!record || now - record.start > windowMs) {
    ipRateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  record.count += 1;
  return record.count <= limit;
}

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();
  const origin = request.headers.get('origin') || '';
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   request.headers.get('x-real-ip') ||
                   '127.0.0.1';

  // Standard Security Headers
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseapp.com https://*.googleapis.com https://apis.google.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';"
  };

  // 1. Strict CORS Policy Handling
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || !origin;
  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowedOrigin && origin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };

  // Handle CORS preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        ...securityHeaders
      }
    });
  }

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

  // 2. Server-Side Protection & Rate Limiting for API Endpoints (/api/*)
  if (pathname.startsWith('/api/')) {
    // Enforce rate limiting on API endpoints
    if (!checkIpRateLimit(clientIp, 60, 60000)) {
      return new Response(
        JSON.stringify({
          error: 'TOO_MANY_REQUESTS',
          status: 429,
          message: 'Rate limit exceeded. Please wait 60 seconds before retrying.'
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            ...corsHeaders,
            ...securityHeaders
          }
        }
      );
    }

    // Whitelist public auth action endpoints
    if (
      pathname === '/api/auth/login' ||
      pathname === '/api/auth/developer-login' ||
      pathname === '/api/auth/verify-table' ||
      pathname === '/api/auth/logout' ||
      pathname === '/api/health'
    ) {
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
            'Expires': '0',
            ...corsHeaders,
            ...securityHeaders
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
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            ...corsHeaders,
            ...securityHeaders
          }
        }
      );
    }

    return;
  }

  // 3. Server-Side Route Guard for Private / Protected Pages
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
      Object.entries(securityHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    }

    if (isDevRoute && !isDeveloper) {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('login', 'true');
      redirectUrl.searchParams.set('role', 'developer');
      const response = Response.redirect(redirectUrl.toString(), 307);
      Object.entries(securityHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
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
