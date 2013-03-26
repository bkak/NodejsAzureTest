var fs = require('fs');
module.exports = {
    write: function(text){
            var stream = fs.createWriteStream("my_file.txt");
            stream.once('open', function(fd) {
                stream.write(text + "\n");
                stream.end();
            });
    }
};