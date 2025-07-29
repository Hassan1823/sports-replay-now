"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import Image from "next/image";

/* ---------- helpers ---------- */
const NavLink = ({ href, label }: { href: string; label: string }) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium transition-colors",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
};

/* ---------- main navbar ---------- */
const Navbar = () => {
  const { refreshToken, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur shadow-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-[0vw] duration-300 lg:px-[2vw] py-[5vh]">
        {/* brand ---------------------------------------------------- */}
        <Link
          href="/"
          className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight uppercase flex justify-center items-center gap-2"
        >
          <Image
            src={"/sports-logo.png"}
            alt="logo"
            width={40}
            height={40}
            className="w-12 h-12 lg:w-[60px] lg:h-[60px] ms-[2vw]"
          />
          Sports&nbsp;<span className="text-primary">Replay</span>&nbsp;NOW
        </Link>

        {/* desktop nav --------------------------------------------- */}
        <nav className="hidden items-center gap-6 md:flex">
          <NavLink href="/plans" label="Plans" />
          <NavLink href="/contact" label="Contact" />
          {user && user.stripePaymentStatus === "paid" && (
            <NavLink href="/videos" label="Videos" />
          )}

          {/* <Button variant="ghost" asChild>
            <Link href="/login">Sign&nbsp;Up&nbsp;Or&nbsp;Login</Link>
          </Button> */}
          {refreshToken ? (
            <Button
              className="w-[12vw] h-auto p-[2%] rounded-full bg-green-600 hover:bg-green-700/80"
              onClick={logout}
            >
              Logout
            </Button>
          ) : (
            <Button
              asChild
              className="w-[12vw] h-auto p-[2%] rounded-full bg-green-600 hover:bg-green-700/80"
            >
              <Link href="/login">Sign&nbsp;Up&nbsp;Or&nbsp;Login</Link>
            </Button>
          )}
        </nav>

        {/* mobile menu --------------------------------------------- */}
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" className="md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="p-0">
            <nav className="flex h-full flex-col gap-6 p-6">
              <Link
                href="/"
                className="text-lg font-bold uppercase flex justify-center items-center gap-2"
              >
                <Image
                  src={"/sports-logo.png"}
                  alt="logo"
                  width={60}
                  height={60}
                />
                Sports Replay NOW
              </Link>

              <NavLink href="/plans" label="Plans" />
              <NavLink href="/contact" label="Contact" />
              {user && user.stripePaymentStatus === "paid" && (
                <NavLink href="/videos" label="Videos" />
              )}
              {/* <NavLink href="/login" label="Log&nbsp;In" /> */}
              {refreshToken ? (
                <Button className="bg-green-600 hover:bg-green-700/80 mt-auto w-full h-auto p-[2%] rounded-full">
                  Logout
                </Button>
              ) : (
                <Button
                  asChild
                  className="bg-green-600 hover:bg-green-700/80 mt-auto w-full h-auto p-[2%] rounded-full"
                >
                  <Link href="/login">Sign&nbsp;Up&nbsp;Or&nbsp;Login</Link>
                </Button>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Navbar;
