// src/data/moods.js — mood → quote suggestions for the post composer.
// Every entry's `quote` must be EXACTLY one of BOOKS_DB[bookId].quotes
// (the quote curation is verbatim-verified against the cloud texts; the
// verify script cross-checks this file against books.js).

export const MOODS = [
  { key: 'love', label: 'In love', entries: [
    { bookId: 'odyssey_1', quote: 'there is nothing better in this world than that man and wife should be of one mind in a house. It discomfits their enemies, makes the hearts of their friends glad, and they themselves know more about it than any one.' },
    { bookId: 'chokher_bali', quote: 'একসময় তুমি আমাকে ভালোবাসিয়াছিলে— এখন সুখের দিনে সেই ভালোবাসার একটুখানি আমার জন্য রাখিয়ো, ভাই—আর সব ভুলিয়া যেয়ো!' },
    { bookId: 'ghore_baire', quote: 'আমি চাই, বাইরের মধ্যে তুমি আমাকে পাও, আমি তোমাকে পাই।' },
    { bookId: 'valmiki_ramayan_2', quote: 'O speak, dear Hanumán, and tell Each word that from her sweet lips fell, Her words, her words alone can give The healing balm to make me live.' },
    { bookId: 'madhushala', quote: 'प्रियतम, तू मेरी हाला है, मैं तेरा प्यासा प्याला' },
  ] },
  { key: 'longing', label: 'Missing home', entries: [
    { bookId: 'odyssey_2', quote: 'there is nothing dearer to a man than his own country and his parents' },
    { bookId: 'pather_panchali', quote: 'আমাদের যেন নিশ্চিন্দিপুর ফেরা হয়—ভগবান— তুমি এই কোরো' },
    { bookId: 'odyssey_3', quote: 'As the sight of land is welcome to men who are swimming towards the shore, when Neptune has wrecked their ship with the fury of his winds and waves; a few alone reach the land, and these, covered with brine, are thankful when they find themselves on firm ground and out of danger—even so was her husband welcome to her as she looked upon him, and she could not tear her two fair arms from about his neck.' },
    { bookId: 'shesher_kabita', quote: 'তোমারে যা দিয়েছিনু সে তোমারি দান; গ্রহণ করেছ যত ঋণী তত করেছ আমায়। হে বন্ধু, বিদায়।' },
  ] },
  { key: 'melancholy', label: 'Melancholy', entries: [
    { bookId: 'crime', quote: 'Pain and suffering are always inevitable for a large intelligence and a deep heart.' },
    { bookId: 'godan', quote: 'महराज, घर में न गाय है, न बछिया, न पैसा। यही पैसे हैं, यही इनका गो-दान है।' },
    { bookId: 'shesher_kabita', quote: 'কালের যাত্রার ধ্বনি শুনিতে কি পাও? তারি রথ নিত্যই উধাও জাগাইছে অন্তরীক্ষে হৃদয়স্পন্দন—' },
    { bookId: 'mahabharata_1', quote: 'Day after day countless creatures are going to the abode of Yama, yet those that remain behind believe themselves to be immortal. What can be more wonderful than this?' },
    { bookId: 'nirmala', quote: 'जिसके ऊपर पड़ती है, वह रोता है, विलाप करता है, पछाड़ें खाता है। यह कोई नई बात नहीं।' },
  ] },
  { key: 'hope', label: 'Hopeful', entries: [
    { bookId: 'crime', quote: 'But that is the beginning of a new story--the story of the gradual renewal of a man, the story of his gradual regeneration, of his passing from one world into another' },
    { bookId: 'gitanjali', quote: 'Into that heaven of freedom, my Father, let my country awake.' },
    { bookId: 'valmiki_ramayan_3', quote: 'Unknown were want, disease, and crime: So calm, so happy was the time.' },
    { bookId: 'siddhartha', quote: 'the river is everywhere' },
    { bookId: 'madhushala', quote: "'राह पकड़ तू एक चला चल, पा जाएगा मधुशाला।'" },
  ] },
  { key: 'courage', label: 'Brave', entries: [
    { bookId: '1984', quote: 'Freedom is the freedom to say that two plus two make four. If that is granted, all else follows.' },
    { bookId: 'chander_pahar', quote: 'তার মন চাঁদের পাহাড় উড়ে যেতে চায় পৃথিবীর দূর, দূর দেশ শত দুঃসাহসিক কাজের মাঝখানে।' },
    { bookId: 'valmiki_ramayan_3', quote: 'Though reft of spear and sword and mace No terror changed his haughty face.' },
    { bookId: 'odyssey_2', quote: 'I am Ulysses son of Laertes, renowned among mankind for all manner of subtlety, so that my fame ascends to heaven.' },
    { bookId: 'mahabharata_2', quote: 'Weapons cleave it not, fire consumeth it not; the waters do not drench it, nor doth the wind waste it. It is incapable of being cut, burnt, drenched, or dried up. It is unchangeable, all-pervading, stable, firm, and eternal.' },
  ] },
  { key: 'peace', label: 'At peace', entries: [
    { bookId: 'meditations', quote: 'Is the cucumber bitter? set it away. Brambles are in the way? avoid them. Let this suffice.' },
    { bookId: 'aranyak', quote: 'ফুলকিয়া বইহারের পরিপূর্ণ জোৎস্না-রাত্রির রূপ এই আমি প্রথম দেখিলাম।' },
    { bookId: 'gitanjali', quote: 'জীবন যখন শুকায়ে যায়' },
    { bookId: 'siddhartha', quote: 'I can think. I can wait. I can fast.' },
    { bookId: 'bhavartha_ramayan', quote: 'ॐ नमो अनादि आद्या । वेदवेदांतवेद्या । वंद्यांही परमवंद्या । स्वसंवेद्या श्रीगणेशा ॥' },
  ] },
  { key: 'wisdom', label: 'Reflective', entries: [
    { bookId: 'meditations', quote: 'Remember that all is but opinion, and all opinion depends of the mind. Take thine opinion away, and then as a ship that hath stricken in within the arms and mouth of the harbour, a present calm' },
    { bookId: 'mahabharata_3', quote: 'Compassion is the highest virtue. Forgiveness is the highest might. The knowledge of self is the highest knowledge. There is nothing higher than truth.' },
    { bookId: 'siddhartha', quote: 'Searching means: having a goal. But finding means: being free, being open, having no goal.' },
    { bookId: 'mahabharata_1', quote: 'The mother is weightier than the earth; the father is higher than the heaven; the mind is fleeter than the wind; and our thoughts are more numerous than grass.' },
    { bookId: 'godan', quote: 'आदमी वह हैं, जिनके पास धन है, अख़्तियार है, इलम है, हम लोग तो बैल हैं और जुतने के लिए पैदा हुए हैं।' },
  ] },
  { key: 'defiance', label: 'Defiant', entries: [
    { bookId: 'gitanjali', quote: 'বিপদে মোরে রক্ষা কর, এ নহে মোর প্রার্থনা, বিপদে আমি না যেন করি ভয়।' },
    { bookId: 'ghore_baire', quote: 'তোমার লোভ আছে, তাই তুমি দেওয়াল গাঁথ। আমার লোভ আছে, তাই আমি সিঁধ কাটি।' },
    { bookId: 'mahabharata_3', quote: 'Since thou wert indifferent to the Kurus and the Pandavas whilst they slew each other, therefore, O Govinda, thou shalt be the slayer of thy own kinsmen!' },
    { bookId: 'odyssey_3', quote: 'Jove takes half the goodness out of a man when he makes a slave of him.' },
    { bookId: 'madhushala', quote: 'मेल कराती मधुशाला' },
  ] },
];
