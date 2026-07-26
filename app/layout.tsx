import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
const geist=Geist({variable:"--font-geist",subsets:["latin"]});
export const metadata:Metadata={title:"SAGE INDEX — Centre de pilotage",description:"Dashboard unifié pour la traçabilité, les ressources humaines et la planification.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body className={geist.variable}>{children}</body></html>}
