import { triviaEmbeddings, triviaItems } from "@/db/schema";
import { getDb } from "@/lib/db";

const seedItems: Array<{
  questionText: string;
  answerText: string;
  distractors: string[];
  category: string;
  subtopic: string;
  difficulty: string;
  canonicalFact: string;
  relationshipType: string;
  primaryEntity: string;
  explanation: string;
}> = [
  {
    questionText: "Which Roman general crossed the Rubicon in 49 BCE?",
    answerText: "Julius Caesar",
    distractors: ["Pompey", "Augustus", "Scipio Africanus"],
    category: "history",
    subtopic: "ancient empires",
    difficulty: "easy",
    canonicalFact: "Julius Caesar crossed the Rubicon River in 49 BCE, sparking civil war.",
    relationshipType: "crossed river",
    primaryEntity: "Julius Caesar",
    explanation: "Caesar's crossing of the Rubicon marked the start of the Roman civil war."
  },
  {
    questionText: "What galaxy contains our Solar System?",
    answerText: "Milky Way",
    distractors: ["Andromeda", "Triangulum", "Whirlpool"],
    category: "science",
    subtopic: "astronomy",
    difficulty: "easy",
    canonicalFact: "The Solar System is located within the Milky Way galaxy.",
    relationshipType: "contains system",
    primaryEntity: "Milky Way",
    explanation: "Earth and the rest of the Solar System orbit within the Milky Way."
  },
  {
    questionText: "What is the capital city of Canada?",
    answerText: "Ottawa",
    distractors: ["Toronto", "Montreal", "Vancouver"],
    category: "geography",
    subtopic: "capitals",
    difficulty: "easy",
    canonicalFact: "Ottawa is the capital city of Canada.",
    relationshipType: "capital of",
    primaryEntity: "Ottawa",
    explanation: "Ottawa, in Ontario, serves as Canada's capital."
  },
  {
    questionText: "Which film won the Academy Award for Best Picture in 1994?",
    answerText: "Forrest Gump",
    distractors: ["Pulp Fiction", "The Shawshank Redemption", "Four Weddings and a Funeral"],
    category: "entertainment",
    subtopic: "film awards",
    difficulty: "medium",
    canonicalFact: "Forrest Gump won the Academy Award for Best Picture at the Oscars honoring 1994 films.",
    relationshipType: "won award",
    primaryEntity: "Forrest Gump",
    explanation: "Forrest Gump took Best Picture at the 67th Academy Awards."
  },
  {
    questionText: "Which scientist proposed the three laws of motion?",
    answerText: "Isaac Newton",
    distractors: ["Galileo Galilei", "Albert Einstein", "Johannes Kepler"],
    category: "science",
    subtopic: "physics discoveries",
    difficulty: "easy",
    canonicalFact: "Isaac Newton formulated the three laws of motion.",
    relationshipType: "formulated laws",
    primaryEntity: "Isaac Newton",
    explanation: "Newton's laws became foundational to classical mechanics."
  },
  {
    questionText: "Which mountain is the tallest above sea level?",
    answerText: "Mount Everest",
    distractors: ["K2", "Kangchenjunga", "Lhotse"],
    category: "geography",
    subtopic: "rivers and mountains",
    difficulty: "easy",
    canonicalFact: "Mount Everest is the highest mountain above sea level.",
    relationshipType: "highest peak",
    primaryEntity: "Mount Everest",
    explanation: "Everest, in the Himalayas, has the highest elevation above sea level."
  },
  {
    questionText: "Which conflict began after Archduke Franz Ferdinand was assassinated?",
    answerText: "World War I",
    distractors: ["World War II", "The Crimean War", "The Franco-Prussian War"],
    category: "history",
    subtopic: "world wars",
    difficulty: "easy",
    canonicalFact: "The assassination of Archduke Franz Ferdinand helped trigger World War I.",
    relationshipType: "triggered conflict",
    primaryEntity: "Archduke Franz Ferdinand",
    explanation: "The assassination in Sarajevo escalated tensions that led to World War I."
  },
  {
    questionText: "Which singer is known as the 'King of Pop'?",
    answerText: "Michael Jackson",
    distractors: ["Prince", "Elvis Presley", "Justin Timberlake"],
    category: "entertainment",
    subtopic: "music milestones",
    difficulty: "easy",
    canonicalFact: "Michael Jackson is widely known as the King of Pop.",
    relationshipType: "nickname",
    primaryEntity: "Michael Jackson",
    explanation: "Michael Jackson earned the title through his massive global influence in pop music."
  },
  {
    questionText: "Which revolution led to the storming of the Bastille in 1789?",
    answerText: "French Revolution",
    distractors: ["American Revolution", "Haitian Revolution", "Russian Revolution"],
    category: "history",
    subtopic: "revolutions",
    difficulty: "medium",
    canonicalFact: "The storming of the Bastille was a defining early event of the French Revolution.",
    relationshipType: "featured event",
    primaryEntity: "French Revolution",
    explanation: "The Bastille's fall became a symbol of the French Revolution."
  },
  {
    questionText: "Which animated film features the characters Woody and Buzz Lightyear?",
    answerText: "Toy Story",
    distractors: ["Shrek", "Finding Nemo", "Monsters, Inc."],
    category: "entertainment",
    subtopic: "animation",
    difficulty: "easy",
    canonicalFact: "Woody and Buzz Lightyear are central characters in Toy Story.",
    relationshipType: "features characters",
    primaryEntity: "Toy Story",
    explanation: "Toy Story centers on Woody and Buzz and helped launch Pixar's rise."
  },
  {
    questionText: "Which organelle is known as the powerhouse of the cell?",
    answerText: "Mitochondrion",
    distractors: ["Nucleus", "Ribosome", "Golgi apparatus"],
    category: "science",
    subtopic: "biology",
    difficulty: "easy",
    canonicalFact: "The mitochondrion is often called the powerhouse of the cell.",
    relationshipType: "nickname",
    primaryEntity: "Mitochondrion",
    explanation: "Mitochondria generate much of the energy used by eukaryotic cells."
  },
  {
    questionText: "Which river flows through Cairo?",
    answerText: "Nile",
    distractors: ["Amazon", "Danube", "Tigris"],
    category: "geography",
    subtopic: "rivers and mountains",
    difficulty: "easy",
    canonicalFact: "The Nile River flows through Cairo.",
    relationshipType: "flows through",
    primaryEntity: "Nile",
    explanation: "Cairo sits on the Nile, one of the world's most famous rivers."
  }
];

function fakeEmbedding(seed: number) {
  return Array.from({ length: 1536 }, (_, index) =>
    Number((Math.sin(seed + index) * 0.5 + 0.5).toFixed(6))
  );
}

async function main() {
  const db = getDb();

  for (const [index, item] of seedItems.entries()) {
    const [inserted] = await db.insert(triviaItems).values(item).returning();

    await db.insert(triviaEmbeddings).values({
      triviaItemId: inserted.id,
      questionEmbedding: fakeEmbedding(index + 1),
      factEmbedding: fakeEmbedding(index + 101)
    });
  }

  console.log(`Seeded ${seedItems.length} trivia items.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
