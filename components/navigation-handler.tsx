'use client'

import { useEffect } from 'react'

export function NavigationHandler() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) {
        return
      }

      const href = anchor.getAttribute('href')
      if (
        !href ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.target ||
        anchor.hasAttribute('download')
      ) {
        return
      }

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) {
        return
      }

      event.preventDefault()

      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash
      ) {
        const id = decodeURIComponent(url.hash.slice(1))
        const element = document.getElementById(id)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`)
          return
        }
      }

      window.location.assign(`${url.pathname}${url.search}${url.hash}`)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}