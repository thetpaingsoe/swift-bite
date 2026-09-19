import { useAppSelector } from "../store/store";

export function Profile() {
  const user = useAppSelector((s) => s.auth.user);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Profile</h1>
      <p className="mt-1 text-sm text-stone-500">Your account details.</p>
      <div className="mt-4 space-y-2 text-sm">
        <p className="text-stone-900">{user?.name}</p>
        <p className="text-stone-500">{user?.email}</p>
        <p className="text-stone-500 capitalize">{user?.role}</p>
      </div>
    </div>
  );
}
