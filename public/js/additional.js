var active_text;
$(document).ready(function(){
    setInterval(animateTextString, 2000);
    function animateTextString() {
        active_text = $('#animated-strings li.active');
        var total  = $('#animated-strings li').length;
        active_text.addClass('fadeup');
        setTimeout(function() {active_text.attr('class', '')}, 1000);
        if(active_text.index() == total-1) {
            $('#animated-strings li').eq(0).addClass('active');
        } else {
            $('#animated-strings li').eq(active_text.index()+1).addClass('active');
        }
    }

    $('.parallax-layer').parallax({}, {xparallax: '40px', yparallax: '10px'}, {xparallax: '20px', yparallax: '5px'});

    $('#offer-parallax').parallax_bg("50%", 0.3, 615);
});  