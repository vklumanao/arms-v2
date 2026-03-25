export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-bottom text-center">
        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} ARMS. All rights reserved.
        </p>

        <p className="text-xs text-slate-400 mt-1">
          Developed by{" "}
          <a
            href="https://vklumanao.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Vicryl Kez R. Lumanao
          </a>{" "}
          and{" "}
          <a
            href="https://ljsalarda.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Leovin Jozh T. Salarda
          </a>
        </p>
      </div>
    </footer>
  );
}
