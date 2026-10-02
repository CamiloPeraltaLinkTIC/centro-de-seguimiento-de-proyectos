import AuthCard from "@/components/AuthCard";
import LoginForm from "./LoginForm";

export const metadata = { title: "Ingresar · Centro de seguimiento de proyectos" };

export default function LoginPage() {
  return (
    <AuthCard>
      <LoginForm />
    </AuthCard>
  );
}
