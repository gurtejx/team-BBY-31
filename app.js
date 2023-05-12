document.getElementById("question-form").addEventListener("submit", function(event) {
    event.preventDefault(); // prevent default form submission behavior
    console.log("worked\n");
    this.submit(); // submit the form to the iframe
});

document.getElementById("response-frame").addEventListener("load", function() {
    var responseText = this.contentDocument.body.textContent;
    var response = JSON.parse(responseText);
    console.log(response);
    document.getElementById("answer").innerHTML = response.answer;
});