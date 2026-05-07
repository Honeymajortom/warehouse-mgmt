import { useState } from "react";
import { loginUser, requestAccess, registerAdmin } from "../services/authService";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

export default function AuthPage({ isDark, setIsDark }) {
  const [mode, setMode] = useState("login"); // "login" | "register"

  const handleLogin = async (credentials) => {
    return await loginUser(credentials);
  };

  const handleRegister = async (data) => {
    // For now, all new registrations go through requestAccess (pending approval)
    // If you want direct admin creation, use registerAdmin instead
    return await requestAccess(data);
  };

  return mode === "login" ? (
    <LoginPage
      isDark={isDark}
      setIsDark={setIsDark}
      onLogin={handleLogin}
      onSwitchMode={() => setMode("register")}
    />
  ) : (
    <RegisterPage
      isDark={isDark}
      setIsDark={setIsDark}
      onRegister={handleRegister}
      onSwitchMode={() => setMode("login")}
    />
  );
}