"use client";
import { useState, useEffect } from "react";

/** 监听 <html> 的 .dark class，跟随 ThemeProvider 切换返回当前是否深色模式。
 *  用于 syntax highlighter 等不响应 CSS 变量的场景（浅色/深色主题各要一份）。 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
