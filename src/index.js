//Documentation and Resources
//Tone.js
//https://tonejs.github.io/docs/14.7.39/index.html
//https://tonejs.github.io/docs/15.1.22/index.html
//https://deepwiki.com/Tonejs/Tone.js/
//JS, HTML and CSS
//https://www.w3schools.com
//UI elements based on the tutorials by QCT:
//https://www.youtube.com/watch?v=PvdhyURE2yQ
//https://www.youtube.com/watch?v=0oePYYXBmm0
//https://www.youtube.com/watch?v=RMmsZH4xwzY
//Viridis palette generator:
//https://waldyrious.net/viridis-palette-generator/
//https://CRAN.R-project.org/package=viridis
//The Viriditas logo was hand-drawn by me (Peblo Nemo), then processed with stochaster and gimp

import * as THREE from "three";
import * as Tone from "tone";
import "./styles.css";

//------------------ Variables -------------------------------------------------------
//UI elements
let startButton = document.getElementById("startButton");
startButton.addEventListener("click", init);
let container = document.querySelectorAll(".range-slider");
let slider;
let thumb;
let tooltip;
let playButton = document.getElementById("checkPlay");
let seedButton = document.getElementById("seedButton");
let sowButton = document.getElementById("sowButton");
let sowInput = document.getElementById("sowInput") + "";
let show = document.getElementById("show");
//Audio setup
let volume, compressor, filter, reverb, delay, chorus;
let transport, timeline, voice, timeAcumulator;
let playing = false;
//Viriditas variables
let basePairs = [-2, -1, 1, 2];
let dna = [];
let geneLength = 42;
let rna = [];
let rnaToPitch = [];
let rnaToDuration = [];
let rnaToVelocity = [];
//TO DO: Implemente reading frame offset
let pitchFrame = 0;
let durationFrame = 0;
let velocityFrame = 0;

//-------------------- Initializing --------------------------------------------------
function init() {
  //Remove the initial overlay
  let overlay = document.getElementById("overlay");
  overlay.remove();
  //Set slider behaviour - TO DO: Implement sliders for pitch range
  for (let i = 0; i < container.length; i++) {
    slider = container[i].querySelector(".slider");
    thumb = container[i].querySelector(".slider-thumb");
    tooltip = container[i].querySelector(".tooltip");
  }
  slider.addEventListener("input", () => {
    phraseLength();
  });
  tooltip.innerHTML = "2m";
  //Set Seed, Sow and Play/Stop listeners
  seedButton.addEventListener("click", seed);
  sowButton.addEventListener("click", sow);
  playButton.addEventListener("click", togglePlay);
  //Transport initial values
  transport = Tone.getTransport();
  transport.bpm.value = 180;
  transport.loop = true;
  transport.setLoopPoints("1m", "3m");
  //Audio chain
  volume = new Tone.Volume(3).toDestination();
  compressor = new Tone.Compressor(-8, 4).connect(volume);
  filter = new Tone.Filter("A4", "lowpass").connect(compressor);
  reverb = new Tone.Reverb(2).connect(filter);
  reverb.set({
    wet: 0.5,
    preDelay: 0.25,
  });
  delay = new Tone.PingPongDelay("4t", 0.7).connect(reverb);
  delay.set({
    wet: 0.5,
  });
  chorus = new Tone.Chorus().connect(delay);
  chorus.depth = 0.7;
  voice = new Tone.AMSynth().connect(chorus);
  //start main loop
  seed();
  Tone.start();
  play();
  //reset seed button
  seedButton.classList.toggle("button-clicked");
  seedButton.firstElementChild.classList.toggle("icon-clicked");
}

//--------------------- DNA Functions -----------------------------------------
//Seed clears the DNA strand and generates new RNG values
function seed() {
  //stop playing to avoid conflicts
  if (playing) {
    stop();
  }
  dna.length = 0;
  for (let i = 0; i < geneLength; i++) {
    let rng = THREE.MathUtils.randInt(0, 3);
    let nucleotide = basePairs[rng];
    dna.push(nucleotide);
  }
  //makes a callback to weave (and therefore toPitch, toDuration...)
  weave();
  recombine();
  showDNA();
  //Change appearance of the seed button
  seedButton.classList.toggle("button-clicked");
  seedButton.firstElementChild.classList.toggle("icon-clicked");

  console.log("seed");
}

//Sow clears the DNA and translates the input string into numeric base pairs
//G = +2, C = -2, T = +1, A = -1
function sow() {
  //stop playing to avoid conflicts
  if (playing) {
    stop();
  }
  dna.length = 0;
  let nucleotide = [];
  nucleotide = sowInput.split("");
  for (let i = 0; i < sowInput.length; i++) {
    switch (nucleotide[i]) {
      case "G":
        dna.push(2);
        break;
      case "C":
        dna.push(-2);
        break;
      case "T":
        dna.push(1);
        break;
      case "A":
        dna.push(-1);
        break;
      //if the character is not recognized, randomize the base pair
      default:
        let rng = THREE.MathUtils.randInt(0, 3);
        let rngNucleotide = basePairs[rng];
        dna.push(rngNucleotide);
        break;
    }
  }
  //makes a callback to weave (and therefore toPitch, toDuration...)
  weave();
  recombine();
  showDNA();
}

//--------------------- RNA Functions -----------------------------------------
//Weave clears the RNA strand and generates a new array base on the DNA received
//The new strand has values between -6 to +6, with 0 being the normal value
function weave() {
  //stop playing to avoid conflicts
  if (playing) {
    stop();
  }
  //Clear the array
  rna.length = 0;
  let sum;
  for (let i = 0; i < geneLength; i++) {
    sum = dna[i] + dna[i + 1] + dna[i + 2];
    rna.push(sum);
    //CHECK OUT OF RANGE
    i = i + 2;
  }
  //makes a callback for toPitch, toDuration and toVelocity functions
  toPitch();
  toDuration();
  toVelocity();
}

//toPitch creates an array of notes following the RNA strand as intervals,
//ranging from D2 to D6
function toPitch() {
  //Clear ther array
  rnaToPitch.length = 0;
  //first note is D4 + strand offset by default
  let preNote = Tone.Frequency("D4").transpose(rna[0]);
  rnaToPitch.push(preNote);
  for (let i = 1; i < rna.length; i++) {
    preNote = Tone.Frequency(rnaToPitch[i - 1]).transpose(rna[i]);
    //limiter, if the interval goes beyond the range, it gets inverted
    //STRETCHGOAL, variable note range
    let midiNote = Tone.Frequency(preNote).toMidi();
    if (midiNote > 86 || midiNote < 38) {
      preNote = Tone.Frequency(rnaToPitch[i - 1]).transpose(-rna[i]);
    }
    //STRETCHGOAL, scale quantizer
    //for now, BRUTEFORCE quantizer
    if (
      midiNote == 39 ||
      midiNote == 42 ||
      midiNote == 44 ||
      midiNote == 46 ||
      midiNote == 49 ||
      midiNote == 51 ||
      midiNote == 54 ||
      midiNote == 56 ||
      midiNote == 58 ||
      midiNote == 61 ||
      midiNote == 63 ||
      midiNote == 66 ||
      midiNote == 68 ||
      midiNote == 70 ||
      midiNote == 73 ||
      midiNote == 75 ||
      midiNote == 78 ||
      midiNote == 80 ||
      midiNote == 82 ||
      midiNote == 85
    ) {
      midiNote++;
      preNote = Tone.Frequency(midiNote, "midi").toNote();
    }
    rnaToPitch.push(preNote);
  }
}

//Creates an array of durations by multiplying the previous value by RNA strand
//Values like 0, +-6 and +- 1 are mediated
function toDuration() {
  //Clear ther array
  rnaToDuration.length = 0;
  //the initial duration value is "4n" by default
  let preDuration = Tone.Time("4n");
  let mult = 1;
  for (let i = 0; i < rna.length; i++) {
    //that's a lot of ifs, but this way works better that using a switch
    if (rna[i] == 6) {
      mult = 8;
    }
    if (rna[i] < 6 && rna[i] > 1) {
      mult = rna[i];
    }
    if (rna[i] == 1) {
      mult = 1.5;
    }
    if (rna[i] == 0) {
      mult = 1;
    }
    if (rna[i] == -1) {
      mult = 1 / 1.5;
    }
    if (rna[i] < -1 && rna[i] > -6) {
      mult = 1 / -rna[i];
    }
    if (rna[i] == -6) {
      mult = 0.125;
    }
    preDuration = Tone.Time(preDuration).toSeconds();
    preDuration = preDuration * mult;
    //limiter, if out of range back to quarter notes
    if (preDuration < 0.125 || preDuration > 4) {
      preDuration = Tone.Time("4n");
    }
    preDuration = Tone.Time(preDuration).quantize("16n");
    rnaToDuration.push(preDuration);
  }
}

//Creates an array of amplitudes following the RNA strand, values under 0.3 -> 0
function toVelocity() {
  //clar the array
  rnaToVelocity.length = 0;
  let preVelocity = 0.7;
  for (let i = 0; i < rna.length; i++) {
    //This avoid the sequenc decaying into eternal silence
    if (preVelocity == 0.0) {
      preVelocity = 0.7;
    }
    preVelocity = preVelocity + rna[i] / 10.0;
    //Low velocity values are interpreted as silences
    if (preVelocity < 0.3) {
      preVelocity = 0.0;
    }
    //Limiter
    if (preVelocity > 1.0) {
      preVelocity = 1.0;
    }
    rnaToVelocity.push(preVelocity);
  }
}

//--------------------- Protein Functions -----------------------------------------
//Recombine turns the separate arrays of rnaTo... into a series of events in the transport
function recombine() {
  timeAcumulator = 0;
  transport.clear(timeline);
  timeline = transport.schedule((time) => {
    for (let i = 0; i < rna.length; i++) {
      let note = rnaToPitch[i];
      let dur = rnaToDuration[i];
      let vel = rnaToVelocity[i];
      voice.triggerAttackRelease(note, dur, time + timeAcumulator, vel);
      timeAcumulator = timeAcumulator + Tone.Time(dur).toSeconds();
    }
  }, "1:0:0");
}

//--------------------- UI Functions ----------------------------------------------
//Change the length of the loop as defined by the slider
function phraseLength() {
  //move thumb to the value
  let maxVal = slider.getAttribute("max");
  thumb.style.left = (slider.value / maxVal) * 100 + "%";
  //Read value as seconds and change loop length
  let measures = Math.ceil(slider.value / 25) + "m";
  //transport.stop();
  transport.loopEnd = measures;
  recombine();
  //transport.start();
  tooltip.innerHTML = measures;
}

//ShowDNA translates the DNA strand base pairs to a string and displays it
//G = +2, C = -2, T = +1, A = -1
function showDNA() {
  let display = " ";
  for (let i = 0; i < dna.length; i++) {
    switch (dna[i]) {
      case 2:
        display = display + "G";
        break;
      case -2:
        display = display + "C";
        break;
      case 1:
        display = display + "T";
        break;
      case -1:
        display = display + "A";
        break;
      //if the DNA has out of range values
      default:
        display = display + "?";
        break;
    }
  }
  show.innerHTML = display;
}

//--------------------- Standard Functions ----------------------------------------
function play() {
  playing = true;
  transport.loop = true;
  transport.start();
}

function stop() {
  playing = false;
  transport.loop = false;
  transport.stop();
  transport.clear(timeline);
}

function togglePlay() {
  if (playButton.checked) {
    play();
  } else {
    stop();
  }
}
