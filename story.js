/*
  BATTLE RAP BRAWL — story mode: ROAD TO THE BRAWL
  Each battler's road to the card, one chapter each. A chapter is a list of beats played in order:

    { title: 'BIG TEXT', sub: 'small text' }                     a title card
    { scene: 'barbershop', cast: { l, c, r }, lines: [...] }     a dialogue scene (l / c / r = who stands left, center, right)
    { phone: 'cassidy', scene: 'stage:philly', comments: [...], lines: [...] }
                                                                 a call-out video on a phone, comments flying up beside it
    { faceoff: ['rosenberg2', 'mook'], stage: 'rooftop', lines: [...] }
                                                                 the pre-fight face-off: Jay Blac between them, then BATTLE!
    { fight: 'mook', stage: 'rooftop', cpu: 0.45, name: 'THE GATEKEEPER', rule: 'hostile' }
                                                                 a fight (cpu = how good the opponent is, 0 to 1). Lose and you can retry.
    { ending: 'tunnel', lines: [...] }                           the walkout, then the chapter card

  Backgrounds: 'stage:<id>' uses that stage's art (stages.js); any other name is art/story/<name>.jpg.
  Who: a fighter id from fighters.js (only the active roster), 'host' (Jay Blac), or an extra below.
  Lines: { who, text, fx } with fx = 'shake' | 'flash' | 'ohh' | 'boo' | 'zoom'. Add vo: 'name' to play audio/story/name.mp3.
  Rules: 'hostile' = away crowd, your crowd meter fills at half speed.

  ALL DIALOGUE HERE IS PLACEHOLDER. Swap in lines each battler approves, and record them (vo) once they do.
  A chapter with soon: '...' shows on the story screen as coming soon.
  Rewritten for the 8-battler preview (2026-10-26): Rosenberg Raw's road leads chapter 1; Mook's road now runs through ARP's Blue Room.
*/
window.STORY = {
  title: 'ROAD TO THE BRAWL',
  extras: {
    barber1: { name: 'OLD HEAD (BARBER)', file: 'barbers', cell: 0, color: '#9a96a0' },
    barber2: { name: 'YOUNG BARBER', file: 'barbers', cell: 1, color: '#9a96a0' },
  },
  chapters: [
    {
      id: 'rosenberg2',
      battler: 'rosenberg2',
      title: 'ROSENBERG RAW',
      sub: 'ROSENBERG RAW · NORRISTOWN, PA',
      beats: [
        { title: 'ROAD TO THE BRAWL', sub: 'CHAPTER 1 · ROSENBERG RAW' },

        { phone: 'cassidy', scene: 'stage:philly',
          comments: ['OHHHH', 'CASS DIFFERENT', 'ROSENBERG GOTTA ANSWER THIS', 'PHILLY VS NORRISTOWN', 'MAIN EVENT CANT COME FAST ENOUGH', 'THIS CARD IS CRAZY', 'RBE WHERE YOU AT', 'RUN IT'],
          lines: [
            { who: 'cassidy', text: "Norristown. Main event. Y'all know what it is." },
            { who: 'cassidy', text: 'Everybody keep calling Rosenberg the Bell Ringer.' },
            { who: 'cassidy', text: "Cool. I'm coming up the Schuylkill to take the crown.", fx: 'ohh' },
          ] },

        { scene: 'stage:blueroom', cast: { l: 'rosenberg2' }, lines: [
          { who: 'rosenberg2', text: 'Up the Schuylkill, huh? He know where to find me.' },
          { who: 'rosenberg2', text: 'Main event. Let it ring.' },
        ] },

        { scene: 'stage:rooftop', cast: { l: 'rosenberg2', r: 'mook' }, lines: [
          { who: 'mook', text: "You talking real loud for somebody that ain't earned the top of my card yet.", fx: 'zoom' },
          { who: 'rosenberg2', text: 'Earned? I been earning it every weekend at RBE.' },
          { who: 'mook', text: 'Then show me. Right here, right now. Harlem rules.' },
        ] },

        { faceoff: ['rosenberg2', 'mook'], stage: 'rooftop', lines: [
          { who: 'host', text: 'Norristown versus Harlem, on a rooftop in December. Somebody call the super!' },
          { who: 'mook', text: 'Cold world, Rosenberg.' },
          { who: 'rosenberg2', text: 'Let it ring.' },
        ] },

        { fight: 'mook', stage: 'rooftop', cpu: 0.45, name: 'THE GATEKEEPER', note: 'BEAT MOOK TO EARN THE MAIN EVENT' },

        { scene: 'stage:rooftop', cast: { l: 'rosenberg2', r: 'mook' }, lines: [
          { who: 'mook', text: '...Aight. You ready.' },
          { who: 'mook', text: 'But word is the King of Carolina coming to RBE for your crown.' },
          { who: 'rosenberg2', text: "Then I'll see him in the Blue Room." },
        ] },

        { scene: 'barbershop', cast: { l: 'barber1', r: 'barber2' }, lines: [
          { who: 'barber1', text: 'Rosenberg got the energy, no question. But T-Top a whole grizzly bear.' },
          { who: 'barber2', text: 'Grizzly? Rosenberg got all of RBE behind him in that Blue Room!', fx: 'ohh' },
          { who: 'barber1', text: 'Two big men, one small room. Somebody getting hugged.' },
          { who: 'barber2', text: "Then he better keep his distance. Get caught in that bear hug and it's over." },
        ] },

        { title: 'TWO KINGS', sub: "ARP'S BLUE ROOM · RBE" },

        { scene: 'stage:blueroom', cast: { l: 'rosenberg2', r: 'ttop' }, lines: [
          { who: 'ttop', text: 'Bell Ringer? Carolina ring bells too.' },
          { who: 'rosenberg2', text: 'This my room, Bizzy. Blue lights, my crowd.' },
          { who: 'ttop', text: "Then don't wake the bear.", fx: 'shake' },
        ] },

        { faceoff: ['rosenberg2', 'ttop'], stage: 'blueroom', lines: [
          { who: 'host', text: 'Two kings, one crown! The Blue Room is packed tonight!' },
          { who: 'ttop', text: 'Bizzy in the building.' },
          { who: 'rosenberg2', text: 'Somebody ring the bell.' },
        ] },

        { fight: 'ttop', stage: 'blueroom', cpu: 0.6, name: 'TWO KINGS', note: "ARP'S BLUE ROOM · HOME CROWD" },

        { scene: 'stage:blueroom', cast: { l: 'rosenberg2', r: 'ttop' }, lines: [
          { who: 'ttop', text: '...Respect. That room is yours.' },
          { who: 'ttop', text: 'But Cass been waiting on this one a long time. This main event is his.' },
        ] },

        { title: 'THE PRESS CONFERENCE', sub: 'ONE WEEK OUT' },

        { scene: 'presser', cast: { l: 'rosenberg2', c: 'host', r: 'cassidy' }, lines: [
          { who: 'host', text: 'Main event! From Norristown, the Bell Ringer, Rosenberg Raw! And from Philadelphia, Cassidy!', fx: 'flash' },
          { who: 'cassidy', text: "I was battling before y'all had leagues, cameras or apps." },
          { who: 'rosenberg2', text: 'And I been running it every weekend since. Different eras, same result.', fx: 'ohh' },
          { who: 'host', text: "Face off! Let's get the face-off!" },
          { who: 'host', text: "Security! Hold 'em back! Save it for the 12th!", fx: 'shake' },
        ] },

        { faceoff: ['rosenberg2', 'cassidy'], stage: 'venue', lines: [
          { who: 'host', text: "This is the one. BATTLE RAP BRAWL main event. Rosenberg Raw versus Philly's own." },
          { who: 'cassidy', text: "Main event. It's over." },
          { who: 'rosenberg2', text: 'Let it ring.' },
        ] },

        { fight: 'cassidy', stage: 'venue', cpu: 0.72, name: 'MAIN EVENT', note: 'BATTLE RAP BRAWL · MAIN EVENT' },

        { ending: 'tunnel', lines: [
          { who: 'host', text: "That's how you see it going." },
          { who: 'host', text: 'Now come see how it really goes.' },
        ] },
      ],
    },
    {
      id: 'mook',
      battler: 'mook',
      title: 'MURDA MOOK',
      sub: 'MURDA MOOK · HARLEM',
      beats: [
        { title: 'ROAD TO THE BRAWL', sub: 'CHAPTER 2 · MURDA MOOK' },

        { scene: 'stage:venue', cast: { l: 'mook', r: 'host' }, lines: [
          { who: 'host', text: 'Lights. Cameras. The LED wall. Mook, you built a whole arena in Harlem.' },
          { who: 'mook', text: 'Not built. Reset.' },
          { who: 'host', text: 'And you really put yourself on the card?' },
          { who: 'mook', text: "Can't throw the party in Harlem and not pull up to it.", fx: 'zoom' },
        ] },

        { phone: 'dizaster', scene: 'stage:compton',
          comments: ['L.A.!!', 'DIZASTER WILD FOR THIS', 'MOOK DONT MISS', 'WEST SIDE', 'OFF THE DOME', 'HARLEM STAND UP', 'THIS CARD THO', 'SOMEBODY TAG MOOK'],
          lines: [
            { who: 'dizaster', text: 'Mook. Respect. You built the stage.' },
            { who: 'dizaster', text: 'But the West Coast been waiting on an invite.' },
            { who: 'dizaster', text: "L.A. don't ask permission. We pulling up.", fx: 'ohh' },
          ] },

        { scene: 'stage:venue', cast: { l: 'mook', r: 'host' }, lines: [
          { who: 'host', text: 'He said L.A. pulling up.' },
          { who: 'mook', text: 'West Coast always talk the loudest from three thousand miles away.' },
          { who: 'mook', text: 'Let me knock the cold off first.' },
        ] },

        { title: 'THE BLUE ROOM', sub: "RBE · ARP'S ROOM" },

        { scene: 'stage:blueroom', cast: { l: 'mook', r: 'rosenberg2' }, lines: [
          { who: 'rosenberg2', text: 'Look who came to RBE.' },
          { who: 'mook', text: 'ARP said the Blue Room is where the smoke is.' },
          { who: 'rosenberg2', text: 'You tested everybody on that roof. My turn.', fx: 'zoom' },
        ] },

        { faceoff: ['mook', 'rosenberg2'], stage: 'blueroom', lines: [
          { who: 'host', text: 'Harlem versus the Bell Ringer! ARP in the building!' },
          { who: 'rosenberg2', text: 'Let it ring.' },
          { who: 'mook', text: 'Cold world.' },
        ] },

        { fight: 'rosenberg2', stage: 'blueroom', cpu: 0.45, name: 'THE BLUE ROOM', note: 'RBE · ARP RINGSIDE' },

        { scene: 'stage:blueroom', cast: { l: 'mook', r: 'rosenberg2' }, lines: [
          { who: 'rosenberg2', text: '...Aight. Mook ready.' },
          { who: 'rosenberg2', text: 'But Philly watching. Word is Cass been in the lab for months.' },
          { who: 'mook', text: "Then I'll go see the lab." },
        ] },

        { scene: 'barbershop', cast: { l: 'barber1', r: 'barber2' }, lines: [
          { who: 'barber1', text: 'Mook been doing this since before y\'all had phones to record it on.' },
          { who: 'barber2', text: 'Yeah, but Dizaster got the whole West Coast behind him. That energy different.', fx: 'ohh' },
          { who: 'barber1', text: "Energy don't block a freeze. Mook land that special, you stuck in the ice." },
          { who: 'barber2', text: 'Then he better save that meter. When the crowd is his, COLD WORLD wipes the whole block.' },
        ] },

        { title: 'THE BLOCK', sub: 'NORTH PHILLY' },

        { scene: 'stage:philly', cast: { l: 'mook', r: 'cassidy' }, lines: [
          { who: 'cassidy', text: "Harlem's finest, on our block? Somebody get a picture." },
          { who: 'mook', text: 'I came to see if Philly still got that smoke.' },
          { who: 'cassidy', text: 'Philly always got smoke. You gotta go through me first.', fx: 'shake' },
        ] },

        { faceoff: ['mook', 'cassidy'], stage: 'philly', lines: [
          { who: 'host', text: "North Philly came out for this one! Mook, ain't nobody out here clapping for you." },
          { who: 'cassidy', text: 'Welcome to Philly.' },
          { who: 'mook', text: 'Crowd control.' },
        ] },

        { fight: 'cassidy', stage: 'philly', cpu: 0.6, name: 'THE BLOCK', rule: 'hostile', note: 'AWAY CROWD: YOUR CROWD METER FILLS AT HALF SPEED' },

        { scene: 'stage:philly', cast: { l: 'mook', r: 'cassidy' }, lines: [
          { who: 'cassidy', text: '...You different. Respect.' },
          { who: 'cassidy', text: 'But that West Coast boy been in the lab. Main event, Compton coming for you.' },
          { who: 'mook', text: "I saved plenty. Harlem. Main event. Tell him don't be late." },
        ] },

        { title: 'FACE TO FACE', sub: 'THE PRESS CONFERENCE' },

        { scene: 'presser', cast: { l: 'mook', c: 'host', r: 'dizaster' }, lines: [
          { who: 'host', text: 'From Harlem, the man who built this whole thing, Murda Mook! And from Los Angeles, Dizaster!', fx: 'flash' },
          { who: 'dizaster', text: "Y'all keep calling it Mook's card. Main event, L.A. taking it home." },
          { who: 'mook', text: 'Everybody want to take the stage. Nobody want to build one.', fx: 'ohh' },
          { who: 'host', text: 'Oh, he said build one! Face-off! Get up here!' },
          { who: 'host', text: 'Somebody grab Dizaster! Save it for Harlem!', fx: 'shake' },
        ] },

        { faceoff: ['mook', 'dizaster'], stage: 'venue', lines: [
          { who: 'host', text: 'Murda Mook versus Dizaster. BATTLE RAP BRAWL. Harlem, you ready?' },
          { who: 'dizaster', text: 'No script.' },
          { who: 'mook', text: 'It get cold in Harlem in December.' },
        ] },

        { fight: 'dizaster', stage: 'venue', cpu: 0.74, name: 'BATTLE RAP BRAWL', note: 'MURDA MOOK VS DIZASTER · MAIN EVENT' },

        { ending: 'tunnel', lines: [
          { who: 'host', text: "He built the stage. Now he's walking out on it." },
          { who: 'mook', text: 'Harlem. Stand up.' },
          { who: 'host', text: 'That\'s how it goes down. More chapters coming.' },
        ] },
      ],
    },
    { id: 'cassidy', battler: 'cassidy', title: 'CASSIDY', sub: 'PHILADELPHIA', soon: 'COMING SOON' },
    { id: 'ttop', battler: 'ttop', title: 'T-TOP', sub: 'FUQUAY-VARINA, NC', soon: 'COMING SOON' },
  ],
};
