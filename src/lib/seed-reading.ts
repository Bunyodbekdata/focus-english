import type { CefrLevel, ReadingCategory } from "./types";

export interface SeedReadingArticle {
  id: string;
  title: string;
  cefrLevel: CefrLevel;
  category: ReadingCategory;
  summary: string;
  content: string;
}

export const SEED_READING_LIBRARY: SeedReadingArticle[] = [
  {
    id: "reading-a1-morning-routine-nature",
    title: "A Quiet Walk in the City Park",
    cefrLevel: "A1",
    category: "Nature",
    summary: "A short, clear story about starting the morning outside among trees and birds.",
    content: `Every morning, Laylo wakes up at seven o'clock. She drinks a glass of warm water and puts on her comfortable walking shoes. Near her apartment, there is a small green park with tall trees and wide paths.

At seven-thirty, the park is calm and cool. Sunlight comes slowly through the green leaves. Laylo hears birds singing above her head. An older man sits on a wooden bench and reads a newspaper. Two neighbors walk their dog and smile as they pass by.

Laylo walks for twenty minutes. She does not look at her phone while she walks. Instead, she notices the fresh air, the color of the flowers, and the sound of wind in the branches. After her walk, she goes home, makes breakfast, and feels ready to study English with a clear mind.`,
  },
  {
    id: "reading-a1-smart-tools-home",
    title: "Helpful Everyday Technology",
    cefrLevel: "A1",
    category: "Technology",
    summary: "Simple vocabulary describing common digital tools people use at home and work.",
    content: `Modern technology helps people complete simple tasks every day. In the morning, an alarm clock on a phone wakes us up on time. In the kitchen, an electric kettle boils water in only two minutes.

At work or school, many students use laptops and tablets. They read digital books, write short notes, and send emails to their teachers. Video calls also allow families in different cities to talk and see each other clearly.

Technology is most useful when we use it with a plan. Turning off extra notifications helps us stay calm and finish our work faster.`,
  },
  {
    id: "reading-a2-silk-road-markets",
    title: "Markets Along the Ancient Silk Road",
    cefrLevel: "A2",
    category: "History",
    summary: "How travelers and merchants exchanged goods, languages, and ideas across Central Asia.",
    content: `For hundreds of years, the Silk Road connected cities across Asia, the Middle East, and Europe. It was not a single road, but a wide network of desert trails, mountain passes, and oasis towns such as Samarkand and Bukhara.

Merchants traveled in groups called caravans to stay safe during long journeys. They carried silk, tea, spices, paper, glass, and woven carpets. When a caravan arrived at a city market, people from many regions gathered to trade and share news.

More than physical goods moved along these routes. Travelers also shared recipes, music, architecture, and scientific books. Because people needed to communicate with partners from distant lands, learning more than one language became a practical everyday skill.`,
  },
  {
    id: "reading-a2-small-coffee-shop",
    title: "Opening a Neighborhood Bookshop",
    cefrLevel: "A2",
    category: "Business",
    summary: "Practical decisions behind running a small independent local business.",
    content: `Two years ago, Timur decided to open a small bookshop on a quiet side street. Before signing the lease, he spent three months studying the neighborhood. He noticed that students, office workers, and retired teachers often walked past the corner on their way to the train station.

Instead of stocking thousands of random titles, Timur chose a focused collection of language guides, history books, and international novels. He placed a long wooden reading table near the front window so visitors could examine books comfortably before buying.

At first, sales were modest. However, Timur remembered his regular customers' interests and ordered special titles whenever someone asked. Over time, steady service and honest recommendations turned the quiet shop into a reliable local business.`,
  },
  {
    id: "reading-b1-sleep-and-memory",
    title: "Why Sleep Helps You Remember New Words",
    cefrLevel: "B1",
    category: "Science",
    summary: "Research showing how deep sleep strengthens vocabulary retention and language processing.",
    content: `Many language learners assume that studying late into the night will help them remember more vocabulary before an exam. Yet neuroscience research consistently points in the opposite direction: sleep is not passive rest, but an active stage of memory consolidation.

During the day, new words and grammar patterns are stored temporarily in a brain region called the hippocampus. When you enter deep sleep, the brain replays these recent neural patterns and gradually transfers them to long-term storage in the neocortex. Without sufficient sleep, fragile memories fade much more rapidly.

Studies comparing learners who studied in the evening and slept for eight hours against learners who studied in the morning and stayed awake for twelve hours found a measurable difference. Those who slept shortly after reviewing new words recalled both meanings and pronunciation more accurately.

For practical study habits, this suggests a simple adjustment: review your saved notes and vocabulary calmly for fifteen minutes before bed, then put screens away. Allowing the mind to rest lets your earlier focus do its quiet work.`,
  },
  {
    id: "reading-b1-urban-libraries",
    title: "The Quiet Comeback of Public Libraries",
    cefrLevel: "B1",
    category: "Society",
    summary: "Why modern cities are investing again in calm, shared spaces for study and community.",
    content: `When digital books and high-speed internet first became widespread, many commentators predicted that public libraries would slowly disappear. In reality, attendance in redesigned civic libraries across Europe, East Asia, and North America has grown steadily over the past decade.

Part of this renewal comes from what libraries offer beyond printed shelves. Unlike commercial cafés, libraries provide quiet desks, natural light, reliable workspace, and reference collections without requiring visitors to purchase anything. In busy cities where apartments are compact and online noise is constant, an intentionally calm public room has become increasingly rare.

Modern libraries also serve practical community needs: language conversation tables, local archives, digital literacy workshops, and quiet study rooms for independent learners. Rather than competing with technology, they balance it by protecting human attention.`,
  },
  {
    id: "reading-b2-attention-economy",
    title: "Designing Tools for Sustained Attention",
    cefrLevel: "B2",
    category: "Technology",
    summary: "Examining how algorithmic feeds fragment focus and how calmer software supports deep work.",
    content: `Over the past fifteen years, most consumer digital platforms have been optimized for a single metric: time spent scrolling. Infinite feeds, autoplay recommendations, and intermittent notifications exploit predictable patterns in human curiosity, encouraging users to switch contexts every few seconds.

While this architecture maximizes advertising impressions, cognitive psychologists have documented its cost for complex learning. Reading analytical prose, writing a coherent argument, or listening closely to an unfamiliar accent all rely on working memory. Every brief interruption leaves what researchers call "attention residue"—a lingering mental drag that lowers comprehension even after the learner returns to the original task.

In response, a growing movement among educators and software designers advocates for single-purpose learning environments. Rather than surrounding a lecture with twenty competing thumbnails, calm software strips away unrelated pathways and gives the learner explicit control over what enters the screen.

When the interface itself stops competing for attention, learners spend less energy resisting distraction and more energy engaging with the ideas in front of them.`,
  },
  {
    id: "reading-b2-forest-ecosystems",
    title: "How Mountain Watersheds Sustain Downstream Cities",
    cefrLevel: "B2",
    category: "Nature",
    summary: "The ecological link between alpine forests, seasonal snowpack, and clean urban water supplies.",
    content: `Millions of urban residents depend daily on ecosystems they rarely see. High-elevation forests and alpine meadows act as natural reservoirs, regulating both the timing and the purity of freshwater flowing into lowland river basins.

During winter months, mountain ranges accumulate snowpack that melts gradually through spring and summer. Tree canopies shade the ground, slowing snowmelt and preventing sudden floods, while deep root systems stabilize steep soil and filter sediment before runoff enters tributaries.

When upstream slopes lose forest cover due to unchecked logging or severe wildfire, downstream cities experience an immediate double vulnerability: sharper peak flows during storms followed by drier riverbeds in late summer. Municipal water utilities must then spend substantially more on mechanical filtration and reservoir dredging.

Recognizing these hidden hydrological services, several metropolitan regions now fund upstream conservation directly through modest water-utility fees—treating healthy forests not as scenic luxuries, but as essential civic infrastructure.`,
  },
  {
    id: "reading-c1-economics-of-trust",
    title: "Institutional Trust and Long-Term Economic Coordination",
    cefrLevel: "C1",
    category: "Business",
    summary: "An analysis of how predictable rules and transparent norms reduce transaction costs in complex markets.",
    content: `Classical economic models frequently focus on capital allocation, labor productivity, and technological innovation when explaining why certain regions sustain durable growth while others stall. Yet economic historians increasingly emphasize a less tangible variable: the baseline level of institutional trust embedded within a society.

In high-trust environments, commercial agreements require fewer layers of defensive monitoring. Suppliers deliver specialized components without demanding full prepayment; small enterprises secure multi-year credit on transparent terms; and dispute resolution proceeds through predictable legal channels rather than informal patronage. Collectively, these conditions compress transaction costs and allow firms to specialize more deeply.

Conversely, when contractual enforcement is erratic or opaque, rational actors adapt defensively. Businesses remain small and family-bound, capital gravitates toward short-horizon speculation rather than patient infrastructure, and talented professionals devote disproportionate effort to navigating uncertainty rather than creating value.

Crucially, institutional trust is neither inherited permanently nor rebuilt overnight. It emerges incrementally when public rules are applied evenly, accounting practices are legible, and organizations honor commitments even when short-term shortcuts appear advantageous.`,
  },
  {
    id: "reading-c1-printing-press-knowledge",
    title: "Standardization, Marginalia, and the Early Print Revolution",
    cefrLevel: "C1",
    category: "History",
    summary: "How fifteenth-century printing transformed not only book volume, but how scholars verified and compared knowledge.",
    content: `Popular accounts of the fifteenth-century printing press tend to emphasize sheer quantity: the sudden multiplication of books once copied laboriously by hand. Yet historians of science point out that an equally decisive shift lay in textual standardization and visual comparability.

In a manuscript culture, every copy inevitably drifted from its exemplar through scribal fatigue, regional spelling, or omitted diagrams. Two astronomers reading nominally identical treatises in Padua and Krakow could rarely be certain they were examining the same table of planetary positions. Errors accumulated quietly across generations, making empirical correction frustratingly elusive.

Movable type inverted that trajectory. When hundreds of readers received identical editions with numbered pages, uniform indexes, and repeatable woodcut diagrams, discrepancies between inherited theory and direct observation became unmistakable. Readers annotated margins, corresponded across borders citing exact page numbers, and fed corrections directly into revised second editions.

Printing did not immediately eliminate error, of course; in its first decades it also circulated old misconceptions more widely than ever before. What it permanently altered was the collective feedback loop through which errors could be detected, debated, and superseded.`,
  },
  {
    id: "reading-c2-epistemology-of-measurement",
    title: "The Paradox of Precision in Complex Adaptive Systems",
    cefrLevel: "C2",
    category: "Science",
    summary: "Why finer quantitative metrics can clarify local dynamics yet obscure emergent systemic behavior.",
    content: `Contemporary scientific and policy institutions possess an unprecedented capacity to instrument the physical and social world. Satellite telemetry, high-frequency sensors, and granular administrative records generate continuous streams of measurement that earlier researchers could scarcely have imagined. Naturally, this abundance fosters an intuitive assumption: that greater resolution yields proportionately deeper understanding.

Yet researchers studying complex adaptive systems—ranging from atmospheric circulation to urban labor markets—regularly encounter an instructive paradox. In tightly coupled systems characterized by nonlinear feedback loops, measuring individual components with exquisite precision does not automatically render macroscopic behavior predictable. Indeed, an excessive fixation on easily quantifiable proxies can actively distort perception when unmeasured variables govern system resilience.

Goodhart's observation—that once a measure becomes a target, it ceases to be a reliable measure—illustrates only the behavioral facet of this difficulty. A subtler epistemological hazard arises when analytical frameworks treat model legibility as synonymous with reality. What resists clean parameterization—informal ecological buffers, tacit institutional judgment, or cultural adaptability—quietly drops out of the formal ledger until an unexpected shock exposes its indispensable role.

Sound scientific judgment therefore demands a dual discipline: refining quantitative instruments wherever empirical precision clarifies causal mechanisms, while retaining the humility to interpret numerical outputs alongside qualitative context and structural uncertainty.`,
  },
  {
    id: "reading-c2-civic-deliberation",
    title: "Deliberative Pace in an Era of Instantaneous Commentary",
    cefrLevel: "C2",
    category: "Society",
    summary: "Exploring the tension between real-time public reaction and the slower tempo required for reasoned civic judgment.",
    content: `Democratic governance was historically structured around friction. Between the emergence of a public controversy and the enactment of legislation lay intervals of correspondence, committee inquiry, regional consultation, and formal debate. Though often criticized as cumbersome, these temporal buffers performed an understated cognitive function: they afforded participants space to gather evidence, test counterarguments, and revise initial intuitions before committing to irreversible positions.

Modern communication infrastructure compresses that interval nearly to zero. Events unfold alongside instantaneous commentary, rewarding rhetorical immediacy over analytical thoroughness. Within such an accelerated cadence, hesitation is readily misconstrued as evasion, and revising one's view in light of newly surfaced facts can incur a higher reputational penalty than defending an untenable premise with conviction.

Reconciling rapid information flows with thoughtful public reasoning does not require romanticizing slower centuries, nor retreating from broad civic participation. Rather, it invites deliberate institutional design: forums that separate initial fact-finding from final judgment, editorial norms that prize synthesis over velocity, and educational practices that train citizens to read slowly, question framing assumptions, and articulate nuanced arguments in their own words.`,
  },
];
