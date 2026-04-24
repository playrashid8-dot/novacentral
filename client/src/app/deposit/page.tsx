"use client";

import { useState } from "react";
import Image from "next/image";

export default function DepositPage() {
  const [copied, setCopied] = useState(false);

  const wallet = "0xA1B2C3D4E5F6G7H8I9J0K1234567890ABCDEF";

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white px-4 pb-24">

      {/* HEADER */}
      <h1 className="text-xl font-bold pt-5">💰 Deposit</h1>

      {/* CARD */}
      <div className="mt-6 rounded-3xl p-[1px] bg-gradient-to-r from-purple-500 to-indigo-500">
        <div className="bg-[#0b0b0f] rounded-3xl p-5">

          <p className="text-gray-400 text-sm">Send USDT (BEP20)</p>

          {/* WALLET */}
          <div className="mt-4 bg-black/40 p-3 rounded-xl text-sm break-all">
            {wallet}
          </div>

          {/* COPY BUTTON */}
          <button
            onClick={copyAddress}
            className="mt-3 w-full bg-purple-600 p-3 rounded-xl"
          >
            {copied ? "Copied ✅" : "Copy Address"}
          </button>

          {/* QR CODE */}
          <div className="mt-6 flex justify-center">
            <Image
              src="/qr.png"
              alt="QR"
              width={150}
              height={150}
              className="rounded-xl"
            />
          </div>

        </div>
      </div>

      {/* INFO */}
      <div className="mt-6 space-y-3 text-sm text-gray-400">
        <p>• Minimum deposit: $10</p>
        <p>• Network: BNB Smart Chain (BEP20)</p>
        <p>• Auto credit after confirmation</p>
      </div>

      {/* HISTORY */}
      <div className="mt-6">
        <h2 className="font-semibold mb-3">Recent Deposits</h2>

        <div className="bg-[#0b0b0f] p-4 rounded-xl flex justify-between">
          <span>$200</span>
          <span className="text-yellow-400">Pending</span>
        </div>

        <div className="bg-[#0b0b0f] p-4 rounded-xl flex justify-between mt-2">
          <span>$500</span>
          <span className="text-green-400">Confirmed</span>
        </div>
      </div>

    </div>
  );
}