import LoginForm from "./login-form";
export default function Login() {
  return (
    <LoginForm
      demo={
        process.env.DEMO_MODE === "true" &&
        process.env.NODE_ENV !== "production"
      }
    />
  );
}
