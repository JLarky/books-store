import { post, route } from "remix/routes";

export const routes = route({
  home: "/",
  health: "/health",
  login: "/login",
  app: "/app",
  categories: "/app/categories",
  category: "/app/categories/:categoryId",
  backup: "/app/backup",
  account: "/account",
  invite: "/invite/:inviteId",
  share: "/share/:shareId",
  shareCategory: "/share/:shareId/categories/:categoryId",
  bookImage: "/books/:bookId/image",
  logout: post("logout"),
  devLogin: post("dev-login"),
  api: route("api", {
    auth: route("auth", {
      registerOptions: post("register/options"),
      registerVerify: post("register/verify"),
      loginOptions: post("login/options"),
      loginVerify: post("login/verify"),
      inviteOptions: post("invite/options"),
      inviteVerify: post("invite/verify"),
    }),
  }),
});
