"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import PamtenLogo from "@/components/PamtenLogo";

const navItems = [
  { name: "Dashboard", href: "/recruiter/dashboard" },
  { name: "Post a Job", href: "/recruiter/job-post" },
  { name: "Applications", href: "/recruiter/applications" },
];

export default function DashboardNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full px-6 py-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 transition-colors duration-300"
    >
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          <PamtenLogo width={70} height={35} className="h-7 w-auto" />
          RecruitEdge
        </Link>

        <div className="hidden md:flex gap-6 text-gray-900 dark:text-white text-sm">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="hover:text-purple-600 dark:hover:text-purple-400 transition duration-300"
            >
              {item.name}
            </Link>
          ))}
        </div>

        <button
          className="md:hidden text-gray-900 dark:text-white"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="md:hidden mt-4 flex flex-col items-center gap-4 text-gray-900 dark:text-white text-sm"
        >
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="hover:text-purple-600 dark:hover:text-purple-400 transition duration-300"
              onClick={() => setIsOpen(false)}
            >
              {item.name}
            </Link>
          ))}
        </motion.div>
      )}
    </motion.nav>
  );
}
