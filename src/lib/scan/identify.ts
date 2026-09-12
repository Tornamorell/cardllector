// Reads a card from a photo of its front with Claude (D31). Server only: needs ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { IDENTIFY_MODEL, type CardReading, type IdentifyContext } from "./reading";

let client: Anthropic | null = null;

const TCG_SYSTEM = `You identify trading cards (Magic: The Gathering, Pokémon TCG and others) from a phone
photo of the card's front. Report what is printed on the card: its name exactly as printed, in the
card's language; its collector number as printed (for example "123/280", "0001" or "TG12"); and the
set code if one is printed next to the number (for example "MKM" or "PAL").
If the photo is not a trading card, set is_card to false.`;

function albumSystem(setName: string | null) {
  return `You identify football (soccer) trading cards from a phone photo of the card's front.
${setName ? `The cards belong to the Panini album «${setName}».\n` : ""}Report what is printed on the card: the player's name as printed (for cards with several players, all
of them separated by " - "), the team, the card number if one is printed on the front, and the series.
Choose the series from the card's design and any printed series name (for example «ÉLITE», «POWER»,
«SPECIAL ONE», «VÉRTIGO», «ZONA VIP»). A plain player card with no series name is «Básica».
If the photo is not a football card, set is_card to false.`;
}

const name = z.string().describe("The name exactly as printed on the card");
const number = z.string().nullable().describe("The card number if one is printed on the front, else null");

/** What the model read, and the tokens it cost. `reading` is null if it gave no answer. */
export async function readCard(
  jpeg: Buffer,
  context: IdentifyContext,
): Promise<{ reading: CardReading | null; usage: { input_tokens: number; output_tokens: number } }> {
  client ??= new Anthropic();
  const image = {
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/jpeg" as const, data: jpeg.toString("base64") },
  };
  const messages = [
    { role: "user" as const, content: [image, { type: "text" as const, text: "Identify this card." }] },
  ];
  // Room for Sonnet 5's adaptive thinking; a reading itself is ~50 tokens.
  const max_tokens = 2000;

  if (context.game === "sports" && context.series.length) {
    const schema = z.object({
      is_card: z.boolean(),
      name,
      team: z.string().nullable(),
      number,
      series: z.enum(context.series as [string, ...string[]]),
    });
    const response = await client.messages.parse({
      model: IDENTIFY_MODEL,
      max_tokens,
      system: albumSystem(context.setName),
      messages,
      output_config: { format: zodOutputFormat(schema) },
    });
    const out = response.parsed_output;
    return {
      reading: out
        ? { isCard: out.is_card, name: out.name, team: out.team, number: out.number, setCode: null, series: out.series }
        : null,
      usage: response.usage,
    };
  }

  const schema = z.object({
    is_card: z.boolean(),
    name,
    number,
    set_code: z.string().nullable().describe("The set code printed next to the number, else null"),
  });
  const response = await client.messages.parse({
    model: IDENTIFY_MODEL,
    max_tokens,
    system: TCG_SYSTEM,
    messages,
    output_config: { format: zodOutputFormat(schema) },
  });
  const out = response.parsed_output;
  return {
    reading: out
      ? { isCard: out.is_card, name: out.name, team: null, number: out.number, setCode: out.set_code, series: null }
      : null,
    usage: response.usage,
  };
}
