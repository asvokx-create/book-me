export type MobileNavigationState = {
  status: "loading" | "signed-out" | "signed-in";
  showLogin: boolean;
  showCreateAccount: boolean;
  showAccount: boolean;
  showLogout: boolean;
  showProviderDashboard: boolean;
  showAdminDashboard: boolean;
};

export function getMobileNavigationState({
  isPending,
  authenticated,
  role,
  isAdmin = false,
}: {
  isPending: boolean;
  authenticated: boolean;
  role?: string | null;
  isAdmin?: boolean;
}): MobileNavigationState {
  if (isPending) {
    return {
      status: "loading",
      showLogin: false,
      showCreateAccount: false,
      showAccount: false,
      showLogout: false,
      showProviderDashboard: false,
      showAdminDashboard: false,
    };
  }

  if (!authenticated) {
    return {
      status: "signed-out",
      showLogin: true,
      showCreateAccount: true,
      showAccount: false,
      showLogout: false,
      showProviderDashboard: false,
      showAdminDashboard: false,
    };
  }

  return {
    status: "signed-in",
    showLogin: false,
    showCreateAccount: false,
    showAccount: true,
    showLogout: true,
    showProviderDashboard: role === "provider",
    showAdminDashboard: isAdmin,
  };
}
