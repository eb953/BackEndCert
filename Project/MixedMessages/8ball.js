function getMessage(){
    const opening = ['Let me think', "That's interesting", 'Well well well', 'Oh look who it is', ' Come back for more?', 'Enough with the shaking!'];
    const answer = ['It is certain!', 'Without a doubt', 'It is decidedly so', 'Yes definitely', 'You may rely on it', 'As I see it yes', 'Most likely', 'Outlook good'];
    const closing = ['Hope that helps!', 'Now shake to find out more', 'BRB', 'Please go away', 'Thanks!', "I'm tired"];

    const beginning = opening[Math.floor(Math.random() * opening.length)];
    const middle = answer[Math.floor(Math.random() * answer.length())];
    const end = closing[Math.floor(Math.random() * closing.length())]; 

    return `${beginning} ${middle} ${end}`; 

}

console.log(getMessage());