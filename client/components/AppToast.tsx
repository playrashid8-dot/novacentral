"use client";

type Props = {
  message: string;
};

export default function AppToast({ message }: Props) {
  if (!message) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-purple-600 px-4 py-2 rounded-xl text-sm shadow-lg z-50 text-white">
      {message}
    </div>
  );
}
