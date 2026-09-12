export const siteConfig = {
  name: "SAIWAY",
  tagline: "Your easy way to Siem Reap",
  description:
    "Private airport transfers with trusted local drivers in Siem Reap.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  links: {
    home: "/",
    booking: "/booking",
    about: "/about",
    driver: "/driver",
    admin: "/admin",
  },
};

export const brandColors = {
  primary: "#032EA1",
  primaryDark: "#021F73",
  accent: "#E00025",
  background: "#F3F6FC",
  surface: "#FFFFFF",
  text: "#101B3D",
};

export const defaultHeroBackground =
  "https://upload.wikimedia.org/wikipedia/commons/4/41/Angkor_Wat.jpg";

export const defaultHeroBackgroundCredit =
  "Angkor Wat.jpg by Bjørn Christian Tørrissen, Wikimedia Commons, CC BY-SA 4.0";
