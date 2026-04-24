"use client";

export default function Team() {

  const team = [
    { name: "Ali", amount: "$500" },
    { name: "Ahmed", amount: "$200" },
    { name: "Usman", amount: "$150" },
  ];

  return (
    <div className="min-h-screen px-4 py-6 text-white">

      <h1 className="text-xl font-bold mb-5">👥 My Team</h1>

      <div className="card mb-4">
        <p>Total Members: <b>25</b></p>
        <p>Total Earnings: <b>$1250</b></p>
      </div>

      <div className="space-y-2">

        {team.map((u, i) => (
          <div key={i} className="card flex justify-between">
            <span>{u.name}</span>
            <span className="text-green-400">{u.amount}</span>
          </div>
        ))}

      </div>

    </div>
  );
}