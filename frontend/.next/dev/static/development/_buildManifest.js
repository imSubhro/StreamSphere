self.__BUILD_MANIFEST = {
  "/": [
    "static/chunks/pages/index.js"
  ],
  "/_error": [
    "static/chunks/pages/_error.js"
  ],
  "/dashboard": [
    "static/chunks/pages/dashboard.js"
  ],
  "/meeting/[code]": [
    "static/chunks/pages/meeting/[code].js"
  ],
  "__rewrites": {
    "afterFiles": [],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/",
    "/_app",
    "/_error",
    "/dashboard",
    "/login",
    "/meeting/[code]",
    "/register"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()