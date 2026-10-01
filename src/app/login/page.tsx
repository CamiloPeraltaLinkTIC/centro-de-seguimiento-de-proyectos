import Band from "@/components/Band";
import LoginForm from "./LoginForm";

export const metadata = { title: "Ingresar · Gantt MATERAN" };

export default function LoginPage() {
  return (
    <>
      <Band />
      <main className="login">
        <LoginForm />
      </main>
    </>
  );
}
