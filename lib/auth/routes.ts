const protectedRoots = ['/admin', '/dashboard', '/onboarding', '/checkout'] as const

function isAtOrBelow(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`)
}

export function isProtectedApplicationPath(pathname: string) {
  return protectedRoots.some(root => isAtOrBelow(pathname, root))
    || isAtOrBelow(pathname, '/mentor/dashboard')
}
