import type { EngineStatus } from '../core/engine/engine.js'

export class Timeline {
  constructor(private readonly root: HTMLElement) {}

  render(status: EngineStatus, thumbUrls: Map<number, string>, onSelect: (i: number) => void): void {
    if (this.root.childElementCount !== status.frames.length) {
      this.root.innerHTML = ''
      status.frames.forEach((_, i) => {
        const cell = document.createElement('div')
        cell.className = 'frame-cell'
        cell.dataset.frame = String(i)
        const label = document.createElement('span')
        label.className = 'cell-label'
        label.textContent = String(i)
        cell.appendChild(label)
        cell.addEventListener('click', () => onSelect(i))
        this.root.appendChild(cell)
      })
    }
    status.frames.forEach((f, i) => {
      const cell = this.root.children[i] as HTMLElement
      cell.classList.toggle('locked', f.status === 'locked')
      cell.classList.toggle('rendering', i === status.currentFrame && f.status === 'rendering')
      const url = thumbUrls.get(i)
      const existing = cell.querySelector('img')
      if (url && !existing) {
        const img = document.createElement('img')
        img.src = url
        img.alt = `帧 ${i}`
        cell.appendChild(img)
      }
    })
  }
}
