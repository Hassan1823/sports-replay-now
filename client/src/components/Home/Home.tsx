import { Hero } from "./Hero";
import { HeroSecond } from "./HeroSecond";

export default function HomePage() {
  return (
    <div className="w-full h-auto p-[2%] space-y-[4vh]">
      {/* <Navbar /> */}
      <Hero />
      <HeroSecond />
    </div>
  );
}
