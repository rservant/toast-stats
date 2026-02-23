import React from 'react'

const SiteFooter: React.FC = () => {
  return (
    <footer
      role="contentinfo"
      className="bg-tm-loyal-blue text-white py-4 mt-auto"
      style={{
        borderTop: '3px solid var(--tm-happy-yellow, #F2A900)',
      }}
    >
      <div className="container mx-auto px-4 max-w-[2560px]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm font-tm-body leading-relaxed">
          {/* Attribution */}
          <div className="text-white/80 md:flex-1">
            Built by{' '}
            <a
              href="https://github.com/rservant"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-2 hover:text-tm-happy-yellow transition-colors"
            >
              rservant
            </a>
          </div>

          {/* Links */}
          <div className="inline-flex items-center gap-4">
            <a
              href="https://github.com/rservant/toast-stats"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              Source Code
            </a>
            <span className="text-white/30">•</span>
            <a
              href="https://github.com/rservant/toast-stats/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-white/80 hover:text-white transition-colors"
            >
              Feedback & Issues
            </a>
          </div>

          {/* Disclaimer */}
          <div className="text-white/60 text-xs md:flex-1 md:text-right">
            Unofficial tool — not affiliated with Toastmasters International
          </div>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
