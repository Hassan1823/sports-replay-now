import { LoginForm } from "@/components/(auth)/Login/LoginForm";
import Navbar from "@/components/Home/Navbar";
import React from "react";

const Login = () => {
  return (
    <div>
      <Navbar />

      <LoginForm />
    </div>
  );
};

export default Login;
