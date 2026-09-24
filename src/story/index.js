// 全部章节：序章、五章、终章、尾声
import { CHAPTERS } from './chapters.js';
import prologue from './ch0.js';
import ch1 from './ch1.js';
import ch2 from './ch2.js';
import ch3 from './ch3.js';
import ch4 from './ch4.js';
import ch5 from './ch5.js';
import finale from './ch6.js';
import epilogue from './ch7.js';

export function buildChapters(D) {
  return [prologue, ch1, ch2, ch3, ch4, ch5, finale, epilogue].map((make, i) => {
    const ch = make(D);
    ch.id = i;
    ch.meta = CHAPTERS[i];
    if (i === 7) ch.last = true;
    return ch;
  });
}
