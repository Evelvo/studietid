const mongoose = require('mongoose');

const StudietidSchema = new mongoose.Schema({
    status: { type: String },
    user_id: { type: String },
    fag_id: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
    },
    rom_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room'
    },
    registreringsdato: {
        type: Date,
        default: Date.now
    },
    ferdigdato: {
        type: Date
    },
    kommentar: {
        type: String,
        required: false
    }

});

const Studietid = mongoose.model('Studietid', StudietidSchema);

module.exports = Studietid;
