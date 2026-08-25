import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
const geist=Geist({variable:"--font-geist",subsets:["latin"]});
export const metadata:Metadata={title:"SAGE 360 — Centre de pilotage",description:"Portail SAGE 360 unifié pour la traçabilité, les ressources humaines et la planification.",icons:{icon:"/sage-logo.png"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body className={geist.variable}>{children}</body></html>}

