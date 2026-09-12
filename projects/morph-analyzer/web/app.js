// Mirrors qaamuuska_morph/model.py's SuffixBackoffModel.predict() exactly,
// reading the same model.json exported by scripts/train.py.

const VERB_CLASS_LABELS = {
  1: "Class I (-ay / -tay) — most common, consonant-final stems",
  2: "Class II (-iyay / -isay) — stems ending in -i or -ee",
  3: "Class III (-tay / -atay) — stems ending in -o / -so / -ow",
  4: "Class IV (-aa / -ayd) — stative/adjectival, no imperative form",
};
const GENDER_LABELS = { m: "masculine", f: "feminine", b: "both" };

let MODEL = null;

async function loadModel() {
  const res = await fetch("data/model.json");
  MODEL = await res.json();
}

function predict(task, word) {
  const model = MODEL[task];
  const w = word.toLowerCase().trim();
  for (let k = Math.min(model.max_suffix, w.length); k >= 1; k--) {
    const suf = w.slice(w.length - k);
    const counts = model.tables[String(k)]?.[suf];
    if (counts) {
      const label = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      return [coerceLabel(task, label), k];
    }
  }
  return [coerceLabel(task, model.majority), 0];
}

function coerceLabel(task, label) {
  // verb_class labels are ints in Python's JSON; JS object keys are strings.
  return task === "verb_class" ? Number(label) : label;
}

function analyze(word) {
  word = word.trim();
  if (!word) return null;

  const [posLabel, posK] = predict("pos", word);
  const result = { word, predicted_pos: posLabel, pos_match_suffix_len: posK };

  if (posLabel === "noun") {
    const [genderLabel, genderK] = predict("gender", word);
    result.predicted_gender = genderLabel;
    result.predicted_gender_desc = GENDER_LABELS[genderLabel] || genderLabel;
    result.gender_match_suffix_len = genderK;
  }
  if (posLabel === "verb") {
    const [vclassLabel, vclassK] = predict("verb_class", word);
    result.predicted_verb_class = vclassLabel;
    result.predicted_verb_class_desc = VERB_CLASS_LABELS[vclassLabel] || String(vclassLabel);
    result.verb_class_match_suffix_len = vclassK;
  }
  return result;
}

function renderResult(r) {
  const out = document.getElementById("result");
  if (!r) {
    out.innerHTML = "";
    return;
  }
  const confidence = (k) => (k > 0 ? `matched last ${k} letter${k > 1 ? "s" : ""}` : "no suffix match — default guess");

  let rows = `<div class="row"><span class="label">Part of speech</span><span class="value">${r.predicted_pos}</span></div>
    <div class="note">${confidence(r.pos_match_suffix_len)}</div>`;

  if (r.predicted_gender) {
    rows += `<div class="row"><span class="label">Noun gender</span><span class="value">${r.predicted_gender_desc} (${r.predicted_gender})</span></div>
      <div class="note">${confidence(r.gender_match_suffix_len)}</div>`;
  }
  if (r.predicted_verb_class) {
    rows += `<div class="row"><span class="label">Verb class</span><span class="value">${r.predicted_verb_class_desc}</span></div>
      <div class="note">${confidence(r.verb_class_match_suffix_len)}</div>`;
  }
  out.innerHTML = rows;
}

function handleSubmit(e) {
  e.preventDefault();
  const word = document.getElementById("word-input").value;
  renderResult(analyze(word));
}

window.addEventListener("DOMContentLoaded", () => {
  loadModel().then(() => {
    document.getElementById("status").textContent = "";
    document.getElementById("form").addEventListener("submit", handleSubmit);
  }).catch(() => {
    document.getElementById("status").textContent = "Could not load the model file (data/model.json).";
  });
});
