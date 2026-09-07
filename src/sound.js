// Procedural atmosphere audio, built on the Web Audio API.
//
// The project stack lists howler.js, but howler plays sound *files* and this
// game ships no audio assets — so the wind bed, the proximity heartbeat, the
// lock-on stinger and the pickup/death cues are all synthesised at runtime.
// One shared engine, created lazily and only made audible after the first user
// gesture (browsers keep an AudioContext suspended until then).
//
// Step 6.4 adds two mode-driven layers on top of that: a calm pentatonic bed
// that plays while the yeti hasn't seen you, and a dissonant tremolo string
// cluster that swells in on detection and eases off slowly when it loses you.
// Both are cross-faded by update() from the `threat.mode` readout.

let engine = null

const MUTE_KEY = 'yeti-survival:muted'

// The persisted mute preference. localStorage can throw (privacy modes, disabled
// storage), so every touch of it is guarded. Kept as module functions so the
// HUD button can save the choice even before the audio engine has been built.
export function readMutedPref() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeMutedPref(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // storage unavailable — the toggle still works for this session
  }
}

class Atmosphere {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext
    this.ctx = new Ctx()

    this.master = this.ctx.createGain()
    this.master.gain.value = 0 // silent until resume() fades it up

    // Final mute stage, downstream of everything: pause/resume/revive all drive
    // `master`, so the manual mute lives on its own node where nothing else
    // touches it. Starts at the persisted preference.
    this.muted = readMutedPref()
    this.out = this.ctx.createGain()
    this.out.gain.value = this.muted ? 0 : 1
    this.master.connect(this.out)
    this.out.connect(this.ctx.destination)

    this._buildWind()
    this._buildDrone()
    this._buildCalm()
    this._buildStrings()
    this._buildDark()
    this._buildShed()

    this.threat = 0 // 0..1, smoothed toward the level passed to update()
    this.beatPhase = 0
    this.chase = 0 // 0..1, rises fast on detection, falls slowly on loss
    this.calmPhase = 0
    this.calmNext = 2.5
    this.dark = 0 // 0..1, the 6.6 per-level darkness, smoothed
    this.pulsePhase = 0
    this.sheltered = false // 6.12: true while the player is inside a shed
    this.shelterMix = 0 // smoothed 0..1 — cross-fades the open-air beds to the shed bed
    this.shedCreakPhase = 0
    this.shedCreakNext = 4
    this.awake = false
  }

  _noiseBuffer(seconds) {
    const { ctx } = this
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  // Looping filtered noise with two slow LFOs so it gusts instead of hissing.
  _buildWind() {
    const { ctx } = this
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(4)
    src.loop = true

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 460
    lp.Q.value = 0.6

    const gain = ctx.createGain()
    gain.gain.value = 0.11

    const cutLfo = ctx.createOscillator()
    cutLfo.frequency.value = 0.08
    const cutLfoAmt = ctx.createGain()
    cutLfoAmt.gain.value = 260
    cutLfo.connect(cutLfoAmt).connect(lp.frequency)

    const volLfo = ctx.createOscillator()
    volLfo.frequency.value = 0.13
    const volLfoAmt = ctx.createGain()
    volLfoAmt.gain.value = 0.05
    volLfo.connect(volLfoAmt).connect(gain.gain)

    src.connect(lp).connect(gain).connect(this.master)
    src.start()
    cutLfo.start()
    volLfo.start()

    this.windGain = gain
    this.windLp = lp // 6.12 muffles this while the player is sheltered
  }

  // Low detuned sines that swell in as the threat rises — the dread bed under
  // the heartbeat. Held silent until update() opens the gate.
  _buildDrone() {
    const { ctx } = this
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.master)
    ;[55, 55.5, 82.5].forEach((f) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(gain)
      o.start()
    })
    this.droneGain = gain
  }

  // The "you're safe" bed: a sustained open pad plus a sparse pentatonic motif
  // scheduled by update(). Always sounding; the calmGain gate fades it out
  // under the strings the instant a chase starts and back in once it eases off.
  _buildCalm() {
    const { ctx } = this
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.master)

    // Open-fifth pad (F2 / C3 / A3), gently detuned so it breathes.
    ;[87.31, 130.81, 220].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.detune.value = (i - 1) * 4
      const og = ctx.createGain()
      og.gain.value = 0.14
      o.connect(og).connect(gain)
      o.start()
    })

    this.calmGain = gain
    this.calmScale = [174.61, 196, 220, 261.63, 293.66, 349.23] // F major pentatonic
  }

  // One soft bell-ish note from the calm scale, sometimes doubled a fifth up.
  _calmNote() {
    const { ctx } = this
    const t = ctx.currentTime
    const root = this.calmScale[Math.floor(Math.random() * this.calmScale.length)]
    const voices = Math.random() < 0.4 ? [root, root * 1.5] : [root]
    voices.forEach((f) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.3)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
      o.connect(g).connect(this.calmGain)
      o.start(t)
      o.stop(t + 2.7)
    })
  }

  // The chase layer: a dissonant sawtooth cluster (root / minor-third / tritone
  // / fifth / minor-seventh) through a lowpass and a fast tremolo, for the
  // bowed-panic feel. Silent until update() opens stringsGain on detection, and
  // closed slowly on a loss so the tension bleeds off instead of snapping away.
  _buildStrings() {
    const { ctx } = this
    const gate = ctx.createGain()
    gate.gain.value = 0
    gate.connect(this.master)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    lp.Q.value = 1

    const trem = ctx.createGain()
    trem.gain.value = 0.8
    const tremLfo = ctx.createOscillator()
    tremLfo.frequency.value = 7
    const tremAmt = ctx.createGain()
    tremAmt.gain.value = 0.3
    tremLfo.connect(tremAmt).connect(trem.gain)
    tremLfo.start()

    lp.connect(trem).connect(gate)
    ;[130.81, 155.56, 185, 196, 233.08].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = (i - 2) * 6
      const og = ctx.createGain()
      og.gain.value = 0.13
      o.connect(og).connect(lp)
      o.start()
    })

    this.stringsGain = gate
  }

  // Step 6.6: the per-level darkness. One bed that swells the deeper you get and
  // is stripped back out during the interlude — a sub-bass sine under a pair of
  // low saws a semitone apart (a slow beating dissonance) through a lowpass. On
  // top, update() taps a slow percussion pulse once it's built up. `darkGain`
  // is driven from the game level by update()'s `drive` argument.
  _buildDark() {
    const { ctx } = this
    const gate = ctx.createGain()
    gate.gain.value = 0
    gate.connect(this.master)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 130
    lp.Q.value = 0.8
    lp.connect(gate)

    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 30.87 // B0
    const subG = ctx.createGain()
    subG.gain.value = 0.5
    sub.connect(subG).connect(lp)
    sub.start()
    ;[41.2, 43.65].forEach((f) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = 0.16
      o.connect(og).connect(lp)
      o.start()
    })

    this.darkGain = gate
  }

  // Step 6.12: the shed interior bed. Its own sound, not the open-air calm bed
  // muffled — a low warm pad (C2 / G2, rounder and darker than calm's F pad)
  // plus a heavily lowpassed room tone so it feels enclosed. update() cross-
  // fades this in against the outdoor beds via `shelterMix`, and taps the odd
  // wood creak on top. Deliberately sparse — this is the hook to build the shed
  // out into something deeper later.
  _buildShed() {
    const { ctx } = this
    const gate = ctx.createGain()
    gate.gain.value = 0
    gate.connect(this.master)

    ;[65.41, 98].forEach((f, k) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.detune.value = (k - 0.5) * 6
      const og = ctx.createGain()
      og.gain.value = 0.08
      o.connect(og).connect(gate)
      o.start()
    })

    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer(3)
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 120
    const g = ctx.createGain()
    g.gain.value = 0.12
    src.connect(lp).connect(g).connect(gate)
    src.start()

    this.shedGain = gate
  }

  // One dry wood creak from inside the shed — a short descending sawtooth
  // through a bandpass. Routed through shedGain so it only sounds while you're
  // actually in there.
  _shedCreak() {
    const { ctx } = this
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(170 + Math.random() * 90, t)
    o.frequency.exponentialRampToValueAtTime(85, t + 0.5)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 380
    f.Q.value = 3
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    o.connect(f).connect(g).connect(this.shedGain)
    o.start(t)
    o.stop(t + 0.65)
  }

  // Call from a user gesture (the click that grabs pointer-lock counts).
  resume() {
    if (this.ctx.state === 'suspended') this.ctx.resume()
    if (!this.awake) {
      this.awake = true
      this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 1.4)
    }
  }

  setPaused(paused) {
    this.master.gain.setTargetAtTime(paused ? 0 : 0.9, this.ctx.currentTime, 0.25)
  }

  // Manual mute toggle (the HUD speaker button). Independent of pause and of the
  // resume fade-in. The caller persists the preference; this just applies it.
  setMuted(muted) {
    this.muted = muted
    this.out.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.08)
  }

  // level: 0 (safe) .. 1 (the yeti is on top of you). mode: the raw
  // 'idle' | 'chase' readout, which cross-fades the calm bed and the strings.
  // drive: 0..1 per-level darkness (6.6) — 0 during the interlude, climbing with
  // the game level otherwise. Called every frame.
  update(delta, level, mode, drive = 0) {
    this.threat += (level - this.threat) * Math.min(delta * 3, 1)

    // Chase envelope: snap up when the yeti locks on, ease down slowly when it
    // loses you so the strings recede rather than cut.
    const target = mode === 'chase' ? 1 : 0
    const k = target > this.chase ? delta * 3 : delta * 0.5
    this.chase += (target - this.chase) * Math.min(k, 1)

    const t = this.ctx.currentTime

    // 6.12: whenever the player's sheltered, cross-fade every open-air bed down
    // and the dedicated shed bed up. `openAir` scales the outdoor layers; the
    // shed bed rides `shelterMix` directly.
    this.shelterMix +=
      ((this.sheltered ? 1 : 0) - this.shelterMix) * Math.min(delta * 2.5, 1)
    const openAir = 1 - this.shelterMix
    this.shedGain.gain.setTargetAtTime(0.42 * this.shelterMix, t, 0.4)

    this.droneGain.gain.setTargetAtTime(
      0.14 * this.threat * (0.4 + 0.6 * openAir),
      t,
      0.2,
    )
    this.calmGain.gain.setTargetAtTime(0.6 * (1 - this.chase) * openAir, t, 0.5)
    this.stringsGain.gain.setTargetAtTime(0.5 * this.chase * openAir, t, 0.4)

    // 6.6 darkness bed: ease toward `drive`, a little slower than the strings so
    // the interlude strip-back is a fade, not a cut.
    this.dark += (drive - this.dark) * Math.min(delta * 1.5, 1)
    this.darkGain.gain.setTargetAtTime(0.34 * this.dark * openAir, t, 0.6)
    // A slow low pulse rides on top once the bed is well established and the
    // yeti's actually a factor.
    if (this.dark > 0.45 && this.threat > 0.02) {
      this.pulsePhase += delta
      if (this.pulsePhase >= 1.05) {
        this.pulsePhase = 0
        this._thump(0.14 * this.dark)
      }
    } else {
      this.pulsePhase = 0
    }

    // Sparse calm motif, only while the calm bed is the layer you can actually
    // hear — not mid-chase, and not while you're shut inside a shed.
    if (this.chase < 0.5 && this.shelterMix < 0.5) {
      this.calmPhase += delta
      if (this.calmPhase >= this.calmNext) {
        this.calmPhase = 0
        this.calmNext = 2 + Math.random() * 2.5
        this._calmNote()
      }
    } else {
      this.calmPhase = 0
    }

    // Odd wood creak while you're inside — keeps the shed bed alive.
    if (this.shelterMix > 0.5) {
      this.shedCreakPhase += delta
      if (this.shedCreakPhase >= this.shedCreakNext) {
        this.shedCreakPhase = 0
        this.shedCreakNext = 4 + Math.random() * 6
        this._shedCreak()
      }
    } else {
      this.shedCreakPhase = 0
    }

    if (this.threat > 0.04) {
      // Beat interval: ~1.5s at the edge of awareness → ~0.33s in your face.
      const interval = 1.5 - 1.17 * this.threat
      this.beatPhase += delta
      if (this.beatPhase >= interval) {
        this.beatPhase = 0
        this._thump(0.22 + 0.6 * this.threat)
      }
    } else {
      this.beatPhase = 0
    }
  }

  _thump(vol) {
    const { ctx } = this
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(72, t)
    o.frequency.exponentialRampToValueAtTime(38, t + 0.16)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 0.36)
  }

  // Lock-on hit: a noise swell plus a dissonant sawtooth cluster.
  stinger() {
    const { ctx } = this
    const t = ctx.currentTime

    const n = ctx.createBufferSource()
    n.buffer = this._noiseBuffer(1)
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.setValueAtTime(280, t)
    nf.frequency.exponentialRampToValueAtTime(1900, t + 0.5)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.5, t + 0.06)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    n.connect(nf).connect(ng).connect(this.master)
    n.start(t)
    n.stop(t + 1)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
    g.connect(this.master)
    ;[110, 116.5, 155, 233].forEach((f) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = 0.24
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + 1.15)
    })
  }

  // Soft two-note chime when an ember is grabbed.
  pickup() {
    const { ctx } = this
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    g.connect(this.master)
    ;[660, 990].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.connect(g)
      o.start(t + i * 0.06)
      o.stop(t + 0.5)
    })
  }

  // Green ember (6.7): a brighter, richer arpeggiated major triad — clearly a
  // bigger prize than the plain two-note ember chime.
  greenPickup() {
    const { ctx } = this
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
    g.connect(this.master)
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.connect(g)
      o.start(t + i * 0.05)
      o.stop(t + 0.8)
    })
  }

  // Shed tell (6.12): the yeti at the door while you're hiding inside. All
  // tonal — no noise, no percussion: a slow bowed-string swell with a low
  // AM-wobbled growl underneath. `intensity` (0..1) climbs as he closes, so the
  // last couple of seconds are unmistakable without a jump-scare or a hiss.
  shedTell(intensity = 0) {
    const { ctx } = this
    const t = ctx.currentTime
    const i = Math.max(0, Math.min(1, intensity))

    // bowed strings — a tense minor-second / tritone cluster, slow in, slow
    // out, creeping up in pitch
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(0.0001, t)
    sg.gain.exponentialRampToValueAtTime(0.04 + 0.13 * i, t + 0.4)
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.7)
    const sl = ctx.createBiquadFilter()
    sl.type = 'lowpass'
    sl.frequency.value = 650 + i * 550
    sl.Q.value = 1
    sl.connect(sg).connect(this.master)
    ;[146.83, 155.56, 207.65].forEach((f, k) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f, t)
      o.frequency.linearRampToValueAtTime(f * 1.03, t + 1.4)
      o.detune.value = (k - 1) * 7
      const og = ctx.createGain()
      og.gain.value = 0.5
      o.connect(og).connect(sl)
      o.start(t)
      o.stop(t + 1.8)
    })

    // growl — a low sawtooth with a fast tremolo for the rumble texture,
    // present the whole time he's near and swelling as he closes
    const gg = ctx.createGain()
    gg.gain.setValueAtTime(0.0001, t)
    gg.gain.exponentialRampToValueAtTime(0.03 + 0.13 * i, t + 0.35)
    gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    const gl = ctx.createBiquadFilter()
    gl.type = 'lowpass'
    gl.frequency.value = 200
    gl.connect(gg).connect(this.master)
    const go = ctx.createOscillator()
    go.type = 'sawtooth'
    go.frequency.setValueAtTime(52, t)
    go.frequency.linearRampToValueAtTime(43, t + 1.1)
    const trem = ctx.createGain()
    trem.gain.value = 0.7
    const tremLfo = ctx.createOscillator()
    tremLfo.type = 'sine'
    tremLfo.frequency.value = 19 + i * 6
    const tremAmt = ctx.createGain()
    tremAmt.gain.value = 0.5
    tremLfo.connect(tremAmt).connect(trem.gain)
    go.connect(trem).connect(gl)
    go.start(t)
    go.stop(t + 1.45)
    tremLfo.start(t)
    tremLfo.stop(t + 1.45)
  }

  // 6.12: stepping into a shed. A brief warm rising triad — the "out of the
  // wind, the cold's eased" beat — paired with setSheltered() / the shelterMix
  // cross-fade so the shed bed and the slower warmth drain read by ear.
  shelterEnter() {
    const { ctx } = this
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
    g.connect(this.master)
    ;[196, 261.63, 329.63].forEach((f, k) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.connect(g)
      o.start(t + k * 0.09)
      o.stop(t + 1.1)
    })
  }

  // Flag the player as inside / outside a shed. `sheltered` drives the
  // shelterMix cross-fade in update() (open-air beds out, shed bed in); here we
  // just knock the wind bed right down and clamp its filter so the outdoor wind
  // all but disappears the moment you're through the door.
  setSheltered(on) {
    if (on === this.sheltered) return
    this.sheltered = on
    const t = this.ctx.currentTime
    this.windGain.gain.setTargetAtTime(on ? 0.01 : 0.11, t, 0.5)
    if (this.windLp) this.windLp.frequency.setTargetAtTime(on ? 140 : 460, t, 0.5)
  }

  // Clean getaway (6.7): a short rising three-note flourish when the green ember
  // makes it clear of the yeti's range.
  escape() {
    const { ctx } = this
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
    g.connect(this.master)
    ;[392, 587.33, 880].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.connect(g)
      o.start(t + i * 0.11)
      o.stop(t + 1.1)
    })
  }

  // 6.13 snack (E): a quick crunch-then-lift — two short mid taps and a rising
  // blip, clearly a "you just used something" beat distinct from the ember chime.
  snackEat() {
    const { ctx } = this
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
    g.connect(this.master)
    ;[
      [330, 0],
      [330, 0.08],
      [523.25, 0.17],
      [784, 0.26],
    ].forEach(([f, dt]) => {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = 0.5
      o.connect(og).connect(g)
      o.start(t + dt)
      o.stop(t + dt + 0.12)
    })
  }

  // 6.13 blanket (Q): a soft, warm low swell — a muffled "whump" as it wraps
  // round you. Low sine through a gentle lowpass, plus a quiet major third, so
  // it reads as cosy rather than another alert.
  blanketWrap() {
    const { ctx } = this
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.14)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(180, t)
    lp.frequency.linearRampToValueAtTime(520, t + 0.3)
    lp.frequency.linearRampToValueAtTime(220, t + 0.9)
    lp.connect(g).connect(this.master)
    ;[110, 138.59, 164.81].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = i === 0 ? 0.6 : 0.22
      o.connect(og).connect(lp)
      o.start(t)
      o.stop(t + 1.0)
    })
  }

  // 6.14: throwing the decoy — a short airy whoosh (bandpass noise sweeping
  // down and out) with a soft low thud a beat later for it landing. No pitch,
  // so it doesn't read as a pickup or an alert.
  decoyThrow() {
    const { ctx } = this
    const t = ctx.currentTime

    const n = ctx.createBufferSource()
    n.buffer = this._noiseBuffer(0.6)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1400, t)
    bp.frequency.exponentialRampToValueAtTime(320, t + 0.34)
    bp.Q.value = 0.9
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.22, t + 0.03)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
    n.connect(bp).connect(ng).connect(this.master)
    n.start(t)
    n.stop(t + 0.42)

    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, t + 0.34)
    o.frequency.exponentialRampToValueAtTime(52, t + 0.5)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t + 0.34)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.37)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    o.connect(g).connect(this.master)
    o.start(t + 0.34)
    o.stop(t + 0.62)
  }

  // 6.13: a quiet two-note fall when a snack or blanket window runs out — the
  // "that wore off" tell so the effect ending isn't silent.
  effectEnd() {
    const { ctx } = this
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    g.connect(this.master)
    ;[440, 330].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.connect(g)
      o.start(t + i * 0.12)
      o.stop(t + i * 0.12 + 0.22)
    })
  }

  // One heavy descending boom on game over; the yeti kill also gets the stinger.
  gameOver(kind) {
    const { ctx } = this
    const t = ctx.currentTime
    this.droneGain.gain.setTargetAtTime(0, t, 0.3)
    this.calmGain.gain.setTargetAtTime(0, t, 0.3)
    this.stringsGain.gain.setTargetAtTime(0, t, 0.4)
    this.darkGain.gain.setTargetAtTime(0, t, 0.4)
    this.shedGain.gain.setTargetAtTime(0, t, 0.4)
    this.windGain.gain.setTargetAtTime(0.03, t, 0.4)

    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(kind === 'caught' ? 140 : 90, t)
    o.frequency.exponentialRampToValueAtTime(28, t + 1.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 2.1)

    if (kind === 'caught') this.stinger()
  }

  // Bring the ambience back after a restart (gameOver ducked it).
  revive() {
    const t = this.ctx.currentTime
    this.threat = 0
    this.beatPhase = 0
    this.chase = 0
    this.calmPhase = 0
    this.dark = 0
    this.pulsePhase = 0
    this.sheltered = false
    this.shelterMix = 0
    this.shedCreakPhase = 0
    this.droneGain.gain.setTargetAtTime(0, t, 0.1)
    this.stringsGain.gain.setTargetAtTime(0, t, 0.1)
    this.darkGain.gain.setTargetAtTime(0, t, 0.1)
    this.shedGain.gain.setTargetAtTime(0, t, 0.1)
    this.calmGain.gain.setTargetAtTime(0.6, t, 0.8)
    this.windGain.gain.setTargetAtTime(0.11, t, 0.6)
    if (this.windLp) this.windLp.frequency.setTargetAtTime(460, t, 0.6)
  }

  // 6.6 win screen: strip the tension out and lift a warm rising triad over the
  // calm bed. No boom — this is the one time the game lets up.
  win() {
    const { ctx } = this
    const t = ctx.currentTime
    this.droneGain.gain.setTargetAtTime(0, t, 0.4)
    this.stringsGain.gain.setTargetAtTime(0, t, 0.4)
    this.darkGain.gain.setTargetAtTime(0, t, 0.6)
    this.shedGain.gain.setTargetAtTime(0, t, 0.6)
    this.calmGain.gain.setTargetAtTime(0.5, t, 1.2)
    this.windGain.gain.setTargetAtTime(0.06, t, 1)
    ;[261.63, 329.63, 392, 523.25].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const g = ctx.createGain()
      const at = t + i * 0.18
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.2, at + 0.08)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.9)
      o.connect(g).connect(this.master)
      o.start(at)
      o.stop(at + 2)
    })
  }
}

// Lazily built. The first call usually comes from a gesture handler; if it comes
// from the render loop first, the context is created suspended and stays inert
// until resume().
export function getAtmosphere() {
  if (!engine) {
    try {
      engine = new Atmosphere()
    } catch {
      engine = null
    }
  }
  return engine
}
