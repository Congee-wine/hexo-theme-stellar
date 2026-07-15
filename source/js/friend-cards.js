(() => {
  const initFriendCards = () => {
    document.querySelectorAll('.friend-card-link:not([data-tilt-ready])').forEach(card => {
      card.dataset.tiltReady = 'true'
      let frame

      card.addEventListener('pointermove', event => {
        const bounds = card.getBoundingClientRect()
        const x = (event.clientX - bounds.left) / bounds.width - 0.5
        const y = (event.clientY - bounds.top) / bounds.height - 0.5
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          card.style.setProperty('--tilt-x', `${-y * 20}deg`)
          card.style.setProperty('--tilt-y', `${x * 20}deg`)
        })
      })

      card.addEventListener('pointerleave', () => {
        cancelAnimationFrame(frame)
        card.style.setProperty('--tilt-x', '0deg')
        card.style.setProperty('--tilt-y', '0deg')
      })
    })
  }

  document.addEventListener('DOMContentLoaded', initFriendCards)
  document.addEventListener('pjax:complete', initFriendCards)
})()
