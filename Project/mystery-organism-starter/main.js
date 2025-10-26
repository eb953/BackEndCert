// Returns a random DNA base
const returnRandBase = () => {
  const dnaBases = ['A', 'T', 'C', 'G'];
  return dnaBases[Math.floor(Math.random() * 4)];
};

// Returns a random single stand of DNA containing 15 bases
const mockUpStrand = () => {
  const newStrand = [];
  for (let i = 0; i < 15; i++) {
    newStrand.push(returnRandBase());
  }
  return newStrand;
};


console.log(returnRandBase())
console.log(mockUpStrand())


const pAequorFactory = (specimenNum,dna)=>{
  return {
    specimenNum:specimenNum,
    dna: dna,

    mutate() {
      // Randomly select an index in the dna array
      const idx = Math.floor(Math.random() * this.dna.length);
      const currentBase = this.dna[idx];
      // Define possible mutations (excluding the current base)
      const possibleBases = ['A', 'T', 'C', 'G'].filter(base => base !== currentBase);
      // Select a new base randomly from possibilities
      const newBase = possibleBases[Math.floor(Math.random() * possibleBases.length)];
      // Mutate the dna at idx
      this.dna[idx] = newBase;
      return this.dna;
    },

    compareDNA(otherPAequor){
      const ownDNA = this.dna;
      const otherDna = otherPAequor.dna;

      let commonCount = 0;
      for (let i =0; i<ownDNA.length; i++){
        if (ownDNA[i]===otherDna[i]){
          commonCount++;
        }
      }
      const percentCommon = ((commonCount / ownDNA.length)* 100).toFixed(2);
      console.log(`speciment #${this.specimenNum} and speciment #${otherPAequor.specimenNum} have ${percentCommon}% DNA in common`);
    },

    willLikelySurvive() {
      const cgCount = this.dna.reduce(
        (acc,base) => (base === 'C' || base === 'G') ? acc + 1 : acc, 0
      );
      const cgPercent = cgCount / this.dna.length;
      return cgPercent >= .6;
    }
  }
}

const testOrganism = pAequorFactory(1, mockUpStrand());
console.log(testOrganism);

console.log("Before mutation:", testOrganism.dna.join(''));
testOrganism.mutate();
console.log("After mutation: ", testOrganism.dna.join(''));

const testOrganism2 = pAequorFactory(2, mockUpStrand());
testOrganism.compareDNA(testOrganism2);

console.log(`Specimen #${testOrganism.specimenNum} likely to survive?`, testOrganism.willLikelySurvive());
console.log(`Specimen #${testOrganism2.specimenNum} likely to survive?`, testOrganism2.willLikelySurvive());

const survivingSpecimens = [];
let specimenId = 3; // Avoids id conflict with previous testOrganism(1) and testOrganism2(2)

while (survivingSpecimens.length < 30) {
  const candidate = pAequorFactory(specimenId, mockUpStrand());
  if (candidate.willLikelySurvive()) {
    survivingSpecimens.push(candidate);
  }
  specimenId++;
}

console.log("Number of surviving specimens collected:", survivingSpecimens.length);