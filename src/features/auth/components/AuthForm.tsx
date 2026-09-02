import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { login, register } from "@/features/auth/services/authApi";
import { saveAuthSession } from "@/features/auth/services/authSession";
import { paths } from "@/routes/paths";

export type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

type FormState = {
  email: string;
  password: string;
  username: string;
};

const initialFormState: FormState = {
  email: "",
  password: "",
  username: "",
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return "The auth service did not accept that request.";
}

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRegisterMode = mode === "register";

  function updateField(field: keyof FormState, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
    setErrorMessage(null);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage(null);

    const payload = {
      email: formState.email.trim(),
      password: formState.password,
    };

    try {
      const result = isRegisterMode
        ? await register({
            ...payload,
            username: formState.username.trim(),
          })
        : await login(payload);

      if (result.error) {
        setErrorMessage(getErrorMessage(result.error));
        return;
      }

      saveAuthSession({
        email: result.data.email || payload.email,
        user_id: result.data.user_id,
        username: result.data.username || formState.username.trim(),
      });
      await refreshSession();
      navigate(paths.dashboard, { replace: true });
    } catch {
      setErrorMessage("Could not reach the auth service. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {isRegisterMode && (
        <>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="alex-speed"
            required
            value={formState.username}
            onChange={(event) => updateField("username", event.target.value)}
          />
        </>
      )}

      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="alex@example.com"
        required
        value={formState.email}
        onChange={(event) => updateField("email", event.target.value)}
      />

      <label htmlFor="password">Password</label>
      <div className="password-field">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={isRegisterMode ? "new-password" : "current-password"}
          placeholder="Enter password"
          required
          minLength={8}
          value={formState.password}
          onChange={(event) => updateField("password", event.target.value)}
        />
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((current) => !current)}
        >
          {showPassword ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>

      {errorMessage && (
        <p className="form-message form-message-error" role="alert">
          {errorMessage}
        </p>
      )}

      {message && (
        <p className="form-message form-message-success" role="status">
          {message}
        </p>
      )}

      <button className="primary-button" type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? isRegisterMode
            ? "Creating profile..."
            : "Starting session..."
          : isRegisterMode
            ? "Create profile"
            : "Start session"}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
