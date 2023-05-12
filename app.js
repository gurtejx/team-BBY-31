$(document).ready(function() {
    $('#question-form').submit(function(event) {
      event.preventDefault(); // Prevent default form submission behavior
      var question = $('#question-input').val();
      var language = $('#formLanguageSelect').val();
  
      // Send an AJAX request to the server
      $.ajax({
        type: 'POST',
        url: '/respond',
        data: { prompt: question, language: language },
        success: function(response) {
          // Display the response in the answerDiv
          $('#answer').text(response.answer);
        }
      });
    });
  });
  