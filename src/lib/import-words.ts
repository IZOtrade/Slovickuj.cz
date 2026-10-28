export function parseImport(text: string): { en: string; cz: string; category: string }[] {
  return text.split(/\r?\n/).flatMap(line => {
    let outside = ""; let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (insideQuotes && line[i + 1] === '"') i++; else insideQuotes = !insideQuotes; }
      else if (!insideQuotes) outside += line[i];
    }
    const delimiter = outside.includes("\t") ? "\t" : outside.includes(";") ? ";" : ",";
    const fields: string[] = []; let value = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
      else if (char === delimiter && !quoted) { fields.push(value.trim()); value = ""; }
      else value += char;
    }
    fields.push(value.trim());
    if (quoted || !fields[0] || !fields[1] || fields.length < 2) return [];
    if (/^(en|english|anglicky)$/i.test(fields[0]) && /^(cz|cs|czech|česky)$/i.test(fields[1])) return [];
    return [{ en: fields[0], cz: fields[1], category: (fields[2] ?? "").replace(/^\[|\]$/g, "") }];
  });
}
