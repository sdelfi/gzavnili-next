jQuery(function () {
    jQuery('.type-switcher button').click(function () {
        jQuery(this).addClass('active')
            .siblings('button').removeClass('active');
        console.log(jQuery(this).val());
        jQuery(this).closest('.loginpage')
            .find('.blocks #b-' + jQuery(this).val()).addClass('active')
            .siblings('.block').removeClass('active')

        return false;
    })

    if (jQuery(".flagselect").get(0)) {
        jQuery(".flagselect").select2({
            templateSelection: formatState,
            templateResult: formatState,
            minimumResultsForSearch: Infinity
        });
    }
    
	
	// Step 1
    jQuery('.js-forgot-btn').click(function() {
        var active = jQuery('.type-switcher .active').val();
        if(active == 'phone') {
			//If reset by phone
			jQuery.post('/ajax/forgotSms.cfm', {
				'forgot_phone' : jQuery('.loginpage input#phone').val(), 
				'prefix' : jQuery('.loginpage #prefix :selected').val()
			}, function(response) { //get or post 
				if(response.MESSAGE == '') {
					goStep('phone');
				} else {
					alert(response.MESSAGE);
					return false;
				}
			})
        } else { 
			//If reset by email
			jQuery.post('/ajax/forgot.cfm', {  //get or post 
				'forgot_username' : jQuery('.loginpage input#email').val()
			}, function(response) {
				if(response.MESSAGE == '') {
					goStep('mail');
				} else {
					alert(response.MESSAGE);
					return false;
				}
			})
        }
        return false;
    })
	
	// Step 2 - check phone verification code
	jQuery('body').on('click', '.js-forgot-btn-phone', function() {
		jQuery.post('/ajax/checkSmsCode.cfm', {
			'code' : jQuery('.loginpage input#tempcode').val()
		}, function(response) {
			if(response.MESSAGE == '') {
				//alert('We sent you a link to the link to the password change page');
				location.href = response.LINK//'/'; // Redirect url
				return false;
			} else {
				alert(response.MESSAGE);
				return false;
			}
		})
	})
})

function formatState(state) {
    if (!state.id) {
        return state.text;
    }
    var $state = jQuery(
        '<span class="selected-item-lang"><img src="/css/' + state.element.value.toLowerCase() + '.png" class="img-flag" /> <span class="lang-text">' + state.text + '</span></span>'
    );
    return $state;
};


function goStep(step) {
    var cStep  = jQuery('.loginpage .step.active'),
        nStep = jQuery('.loginpage .step-' + step);
    if(step == 'mail') {
        nStep.find('.change').text(nStep.find('.change').text().replace('{mail}', jQuery('#b-email input').val()))
    } else if(step == 'phone') {
        nStep.find('.change').text(nStep.find('.change').text()
                .replace('{phone}', jQuery('#b-phone select :selected').text() + ' ' + jQuery('#b-phone input').val()))
    }
    cStep.fadeOut(function() {
        cStep.removeClass('active');
        nStep.fadeIn(function() {
            nStep.addClass('active');
        })
    })
}