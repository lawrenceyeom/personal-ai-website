import React, { ReactNode } from "react";
import Link from "next/link";
import Head from "next/head";

type Props = {
  children?: ReactNode;
  title?: string;
};

const Layout = ({ children, title = "个人AI助手" }: Props) => (
  <div className="min-h-screen flex flex-col">
    <Head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <header className="bg-[#101624] text-white p-4 shadow-md">
      <nav className="container mx-auto flex justify-between items-center">
        <div className="flex space-x-4 items-center">
          <Link href="/">
            <a className="text-xl font-bold text-white hover:text-blue-300">首页</a>
          </Link>
        </div>
        <div className="flex space-x-4">
          <Link href="/settings">
            <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">设置</a>
          </Link>
        </div>
      </nav>
    </header>
    <main className="flex-grow">
      {children}
    </main>
    <footer className="bg-[#101624] text-white p-4 text-center">
      <div className="container mx-auto">
        <p className="text-sm">© {new Date().getFullYear()} 个人AI助手</p>
      </div>
    </footer>
  </div>
);

export default Layout;
