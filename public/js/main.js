var xhrTnU;
//var xhrsTo = {};
var xhrs = {};
var aCcache = {};

function checkDelivery() {
	var city = $('#city'), select2 = $('.deliveryOffice-col select'), offices = [];
	$('.deliveryOffice-col').hide();
	select2.val('')
	
	if (select2.hasClass("select2-hidden-accessible")) {
		select2.select2('destroy');
	}
	
	if(city.val() !== '' && deliveryOffices.length) {
		for(var dK in deliveryOffices) {
			//console.log(deliveryOffices[dK]);
			var cityToCheck = deliveryOffices[dK].CITY;
			if(cityToCheck.trim().toLowerCase() === city.val().trim().toLowerCase()) {
				offices.push(deliveryOffices[dK]);
			}
		}
		
		if(offices.length) {
			select2.find('option').not('.first').not('.delivery').remove();
			for(var oId in offices) {
				var office = offices[oId];
				//$('<option value="' + office.ID + '">' + office.OFFICE + '</option>').insertBefore(select2.find('.delivery'));
				$('<option value="' + office.ID + '">' + office.OFFICE + '</option>').appendTo(select2);
			}
			
			if(select2.data('value')) {
				select2.val(select2.data('value'));
			}
			
			$('.deliveryOffice-col').show();
			if (!select2.hasClass("select2-hidden-accessible")) {
				select2.select2({minimumResultsForSearch: Infinity});
			}
		}
	}
}

function CheckEnglishOnly(field) {
    var sNewVal = "";
    var sFieldVal = field.value;

    for (var i = 0; i < sFieldVal.length; i++) {
        var ch = sFieldVal.charAt(i);
        var c = ch.charCodeAt(0);

        if (c < 0 || c > 255) {
            // Discard
        } else {
            sNewVal += ch;
        }
    }
    if (sNewVal != sFieldVal) {
        alert('Only English Characters Allowed');
    }
    field.value = sNewVal;
}

function CheckGeorgianOnly(field) { 
	if(!$('#doNotGeKeyboard').length || $('#doNotGeKeyboard').length && $('#doNotGeKeyboard').prop('checked') == false) {
		var sNewVal = "";
		var sFieldVal = field.value;

		for (var i = 0; i < sFieldVal.length; i++) {
			var ch = sFieldVal.charAt(i);
			var c = ch.charCodeAt(0);

			if ((c > 64 && c < 4256) || c > 4351) {
				// Discard
			} else {
				sNewVal += ch;
			}
		}
		if (sNewVal != sFieldVal) {
			alert('Only Georgian Characters Allowed');
		}
		field.value = sNewVal;
	}
}

function CheckCitizenZipCode() {
	if($('.countrySelect, [name="country"]').val() === 'GE') {
		$('.zipContainer').hide();
	} else {
		$('.zipContainer').show();
	}
}

function isReceiverUniq() { 
	var resp = true, 
		selector = $('.checkReceiver[data-type=selector]');
	if(selector.length && selector.val() == "" && typeof rcUserId !== 'undefined' && rcUserId !== '') {
		var fName 	= $('.checkReceiver[data-type=firstname]:visible').val()
		var lName 	= $('.checkReceiver[data-type=lastname]:visible').val()
		var city	= $('.checkReceiver[data-type=city]:visible').val()
		
		if(fName != "" && lName != "" && city != "") {
			var kkey = 'isReceiverUniq';
			var value = fName + lName + city;
			if(!(kkey in aCcache)) {
				aCcache[kkey] = {};
			}
			
			if(aCcache[kkey] && typeof aCcache[kkey][value] != 'undefined') {
				return aCcache[kkey][value];
			}
			
			xhrTnU = $.ajax({
				type: "GET",
				url: "/ajax/receiverUniqCheck.cfm",
				async: false, 
				data: {
					'userid': rcUserId,
					'firstname': fName,
					'lastname': lName,
					'city': city
				},
				dataType:"html",
				success: function(msg) {
					resp = (msg === 'true');
					aCcache[kkey][value] = resp;
				}
			});
		}
	}
	return resp;
}


jQuery(function($) {	
	$('body').on('click touchstart', '.labelLink', function(event) {
		//console.log($(this));
		event.stopPropagation();    
		event.preventDefault();
		location.href = $(this).attr('href');
		return false;
	})
	
	
	CheckCitizenZipCode();
	$('.countrySelect, [name="country"]').change(CheckCitizenZipCode);
	
	$('[onchange^=CheckGeorgianOnly]').each(function(k, v) {
		if($.inArray($(v).attr('id'), ['firstname', 'firstnamege', 'lastname', 'lastnamege'])) {
			$(v).on('paste', function() {
				CheckGeorgianOnly(this)
			})
		}
	})
	$('[onchange^=CheckEnglishOnly]').each(function(k, v) {
		if($.inArray($(v).attr('id'), ['firstname', 'firstnamege', 'lastname', 'lastnamege'])) {
			$(v).on('paste', function() {
				CheckEnglishOnly(this)
			})
		}
	})
})

function PasteMonitor(element)
{
	if(typeof element == "string")
	{
		this.target = document.getElementById(element);
	}
	else if(typeof element == "object" || typeof element == "function")
	{
		this.target = element;
	}

	if(this.target != null && this.target != undefined)
	{
		this.target.addEventListener('paste',this.inPaste.bind(this),false);
		this.target.addEventListener('change',this.changed.bind(this),false);
	}
	this.oldstate = "";
}
PasteMonitor.prototype = Object.create({},{
	pasted:{ value: false, enumerable: true, configurable: true, writable: true },
	changed:{ value: function(evt){
		//elements content is changed
		if(typeof this.onChange == "function")
		{
			this.onChange(evt);
		}
		if(this.pasted)
		{
			if(typeof this.afterPaste == "function")
			{
				this.afterPaste(evt);
				this.pasted = false;
			}
		}
	}, enumerable: true, configurable: true, writable: true },
	inPaste:{ value: function(evt){
		var cancelPaste = false;
		if(typeof this.beforePaste == "function")
		{
			// process pasted data
			cancelPaste = this.beforePaste(evt);
		}
		if(cancelPaste == true)
		{
			evt.preventDefault();
			return false;
		}
		this.pasted = true;
		setTimeout(function(){
			var evt = document.createEvent("HTMLEvents");
			evt.initEvent("change", false, true);
			this.target.dispatchEvent(evt);
		}.bind(this),0);
	}, enumerable: true, configurable: true, writable: true }
})
PasteMonitor.prototype.constructor = PasteMonitor;

Number.prototype.formatMoney = function(c, d, t){
    var n = this, 
        c = isNaN(c = Math.abs(c)) ? 2 : c, 
        d = d == undefined ? "." : d, 
        t = t == undefined ? "," : t, 
        s = n < 0 ? "-" : "", 
        i = String(parseInt(n = Math.abs(Number(n) || 0).toFixed(c))), 
        j = (j = i.length) > 3 ? j % 3 : 0;
        return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
};

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

String.prototype.cleanup = function() {
	return this.toLowerCase().replace(/[^a-zA-Z]+/g, "");
}


var resizeTimer = 0,
    $window = $(window),
    $body = $('body'),
    windowWidth = $(window).width() - 20;
    windowHeight = $(window).height() - 20,
	tnumbersCache = {},
	tnumbersCache2 = {};

$(document).ready(initPage);


function checkTopbarSticky() {
	if (stickyNav.css('position') == 'fixed') {
		stickyNavOffsetTop = stickyNavShadow.offset().top;
	}

	/*
	if (stickyNavOffsetTop < 20) {
		stickyNavOffsetTop = stickyNav.offset().top;
	}
	*/
	//var bodyOffset = $(document).scrollTop();
	if (windowW > 767) {
		if(bodyOffset > myparcelsBottom) {
			body.removeClass('stickynav-fixed');
			stickyNav.css('width', '');
		} else if (bodyOffset > stickyNavOffsetTop) {
			body.addClass('stickynav-fixed');
			stickyNavShadow.height(stickyNav.outerHeight());
			stickyNav.css('width', stickyNavWidth);
		} else {
			body.removeClass('stickynav-fixed');
			stickyNav.css('width', '');
		}
	} else {
		body.removeClass('stickynav-fixed');
		stickyNav.css('width', '');
	}
}

var stickyNav, stickyNavShadow, stickyNavContainer, stickyNavOffsetTop = 0, windowW, body, stickyNavWidth, myparcels, myparcelsBottom;

function initPage(){
	
	$('[data-fancybox]').fancybox({
		
	})
	
	$('[data-fancybox-modal]').fancybox({
		modal: true
	})
	
	$(".videohelp a.item").fancybox({
		padding: 0,
		//type: 'youtube.iframe',
		helpers : {
			media : {}
		}			
	});
	
	if($('.videohelp').get(0)) {
		/*
		$('.videohelp .item').click(function() {
			$this = $(this);
			console.log('clicked', $this.data('video'));
			if($this.data('video') != 'undefined' && $this.data('video') != '') {
				$this.fancybox({
					href: $this.data('video'),
					padding: 0,
					//type: 'youtube.iframe',
					helpers : {
						media : {}
					}				
				})
				return true;
			}
			
			return false;
		})
		*/
	}
	
	
    //Floating block 
	stickyNav = $('.parcel-filter-block');
	if (stickyNav.get(0)) {
		body = $('body');
		myparcels = $('section.myparcels');
		stickyNavContainer = $('.parcel-filter-block-container');
		myparcelsBottom = myparcels.offset().top + myparcels.outerHeight() - stickyNav.height();
		stickyNavShadow = $('.parcel-filter-block-shadow');
		stickyNavWidth = stickyNavContainer.width();
		bodyOffset = $(window).scrollTop();
		windowW = $(window).width();
		
        stickyNavOffsetTop = stickyNav.offset().top;
        navbarOffset = 0;
		
		$(window).scroll(function () {
			bodyOffset = $(window).scrollTop();
			setTimeout(function() {			
				checkTopbarSticky();
			}, 300)
		})
		
		$(window).resize(function () {
			stickyNavWidth = stickyNavContainer.width();
			myparcelsBottom = myparcels.offset().top + myparcels.outerHeight() - stickyNav.height();
			windowW = $(window).width();
			setTimeout(function() {			
				checkTopbarSticky();
			}, 300)
		})
		
		setTimeout(function() {			
			checkTopbarSticky();
		}, 300)
	}
	//END: Floating block 
    checkBodyWidth();

    $('input').iCheck({
        checkboxClass: 'icheckbox_minimal',
        radioClass: 'iradio_minimal',
        labelHover: false
    });
    
    $('input').on('ifChecked', function(event){
        $(this).closest('label').addClass('checked-label');
    });
    $('input').on('ifUnchecked', function(event){
        $(this).closest('label').removeClass('checked-label');
    });
    
    $('.icheckbox_minimal.checked, .iradio_minimal.checked').parent('label').addClass('checked-label');

    $(".bluetable tr input").on('ifChecked', function(event){
        $(this).closest('tr').addClass('checked-tr');
    });
    $(".bluetable tr input").on('ifUnchecked', function(event){
        $(this).closest('tr').removeClass('checked-tr');
    });

    $('.bluetable tr .icheckbox_minimal.checked').closest('tr').addClass('checked-tr');

    $('.bluetable').each(function() {
        if($(this).find('.icheckbox_minimal').length) {
            $(this).closest('.bluetable').addClass('hascheckboxes');
        }
    });
    
    $('.bluetable.hascheckboxes tr').click(function() {
        $(this).find("input[type='checkbox']").iCheck('toggle');
    });
    
    
    $('select:visible').select2({
        minimumResultsForSearch: Infinity
    });

    if($('.datepicker').length) {
        $('.datepicker').datetimepicker({
            timepicker:false,
            format:'m/d/Y'
        });
    }

    if($('.homeslider').length) {
        var homegallery = $('.homeslider ul.slider').lightSlider({
            item: 1,
            mode: 'fade',
            auto: true,
            controls: false,
            pager: false,
            pause: 5000,
            speed: 500,
            loop: true,
            pauseOnHover: true,
            onBeforeSlide: function(el) {
                galleryCurrent = el.getCurrentSlideCount() - 1;
                $('.homeslider .slider-controls ul li').removeClass('active');
                $('.homeslider .slider-controls ul li').eq(galleryCurrent).addClass('active');
            }
        });

        galleryTotal = homegallery.getTotalSlideCount();

        $('.homeslider .slider-controls ul li a').on("click", function() {
            var newCurrent = $(this).parent().index() - galleryTotal + 1;
            homegallery.goToSlide(newCurrent);
            return false;
        });

        $('.homeslider').addClass('visible');
    }

    $('.faq-item .question').click(function() {
		$(this).parent().toggleClass('active');
        $(this).parent().siblings().removeClass('active');
    });

    $('.header .language-inner span').click(function() {
        $(this).parent().parent().toggleClass('active');
        $('.headermenu-block').removeClass('active');
        $('.header .office').removeClass('active');
    });
    
    $('.header .office .curr').click(function() {
        $(this).parent().parent().toggleClass('active');
        $('.headermenu-block').removeClass('active');
        $('.header .language').removeClass('active');
    });

    $('.header .office ul li').click(function() {
        var activeOffice = $(this).index();
        var activeOfficename = $(this).html();
        $(this).siblings().removeClass('active');
        $(this).addClass('active');
        $('.header .office').removeClass('active');
        $('.header .office .curr .title').html(activeOfficename);
        $('.topbar-contacts .topbar-contacts-item').eq(activeOffice).addClass('active');
        $('.topbar-contacts .topbar-contacts-item').eq(activeOffice).siblings().removeClass('active');
		checkOpennow();
    });
	checkOpennow();


	
    $('.header .headermenu-toggler').click(function() {
        $('.headermenu-block').toggleClass('active');
        $('.header .language').removeClass('active');
        $('.header .office').removeClass('active');
    });

    $('.usermenu li.tracking-link').click(function() {
        $.featherlight(
            $('#tracking-block'), {
                variant: "w420"
            } 
        );
        return false;
    });
    
    $('.usermenu li.login-link').click(function() {
        $.featherlight(
            $('#login-block'), {
                variant: "w420"
            } 
        );
        return false;
    });

    $('#footer-office').on('change', function() {
        var activeFOffice = $(this).prop('selectedIndex');
        $('.footer-contacts-item').eq(activeFOffice).addClass('active');
        $('.footer-contacts-item').eq(activeFOffice).siblings().removeClass('active');
    });

    $('body.mobile .footermenu .title').on('click', function() {
        $(this).closest('.footermenu').toggleClass('active');
    });


    /*Partner tabs*/
    var tabId;

    $('.ptabs ul li').click(function(){
        if($(this).hasClass('active')) {
            $('.ptabs').toggleClass('expanded');

        }
        else {
            tabId = $(this).attr('data-tab');

            $('.ptabs ul li').removeClass('active');
            $('.ptabs-content-item').removeClass('active');

            $(this).addClass('active');
            $("#"+tabId).addClass('active');
            $('.ptabs').removeClass('expanded');
        }
        
    });
    
    var mapid;

    $('.gmaps-switcher ul li').click(function(){
        if(!$(this).hasClass('active')) {
            mapid = $(this).attr('data-tab');

            $('.gmaps-switcher ul li').removeClass('active');
            $('.gmap-item').removeClass('active');

            $(this).addClass('active');
            $("#"+mapid).addClass('active');            

            /*initMap1();
            
            google.maps.event.trigger(map1, 'resize');
            google.maps.event.trigger(map2, 'resize');*/
            google.maps.event.trigger(map1, 'resize');

            if(mapid == "map-tab-1") {
                google.maps.event.trigger(map1, 'resize');
            }
            if(mapid == "map-tab-2") {
                initMap2();
                google.maps.event.trigger(map2, 'resize');                
            }
            
        }
        
    });

    $('.account-toggler').click(function() {
        $('.account-menu').toggleClass('active');
    });

    $('.stores-menu li.active a').click(function() {
        $('.stores-menu').toggleClass('expanded');
        return false;
    });
	
	$('.reveal-btn-code .cover-btn').click(function() {
        $(this).addClass('hidden');
        $(this).next('.hidden-code').addClass('active');
    });

    $(document).on('click', '.animated', function(event){
        event.preventDefault();

        $('html, body').animate({
            scrollTop: $( $.attr(this, 'href') ).offset().top
        }, 500);
    });
} // end initPage

$('.tooltip-item').tooltipster({
	theme: "tooltipster-light"
});


function checkOpennow() {
	var isOpen = $('.topbar-inner .office ul li.active').data('open');
	if(isOpen === false) {
		$('.header .office .curr .opennow').addClass('hide');
		$('.header .office .curr .closenow').removeClass('hide');
	} else {
		$('.header .office .curr .opennow').removeClass('hide');
		$('.header .office .curr .closenow').addClass('hide');
	}
}

$(window).on('resize', function (e) {
    e.stopPropagation();
    setTimeout(function () {
        if (e.preventDefault) {
            e.preventDefault();
        } else {
            e.returnValue = false;
        }
        checkBodyWidth();

        if($(".gmaps").length) {
            if($('#map-tab-1').hasClass('active')) {
                google.maps.event.trigger(map1, 'resize');    
            }
            if($('#map-tab-2').hasClass('active')) {
                google.maps.event.trigger(map2, 'resize');    
            }
            
            //google.maps.event.trigger(map2, 'resize');
        }
    }, 200);
});

function checkBodyWidth() {
    
    if ($window.width() >= 992) {
        $body.removeClass().addClass('desktop');
    }
    else if (($window.width() >= 768) && ($window.width() < 992)) {
        $body.removeClass().addClass('tablet');
    }
    else {
        $body.removeClass().addClass('mobile');   
    }
}


$(function() {
	
    //Initiall adding
	if($('.templates .product').get(0)) {
		addProduct();
	}
    
	$('body').on('click', '.btn--reply', function() {
		$(this).slideUp();
		$('.mail-reply-container').slideDown();
		$('html,body').animate({scrollTop: $('.mail-reply-container').offset().top},'slow');
		return false;
	})
	
    $('body').on('click', '.helpproduct-f .addproduct', function() {
        addProduct();
        return false;
    })  

    $('body').on('click', '.add_option', function() {
        addOption($(this).data('parent-id'));
        return false;
    })  
    
    $('body').on('click', '.add_comment_option', function(e) {
        addOptionComment(e);
        return false;
    })  
    
    $('body').on('click', '.remove_product', function(e) {
        removeProduct(e);
        return false;
    })  
    
    $('body').on('click', '.helpproduct-primary .add_comment', function(e) {
        addProductComment(e);
        return false;
    })
    
    $('body').on('click', '.remove_option', function(e) {
        removeOption(e);
        return false;
    })  
    
    $('body').on('change input', '.helpproduct-primary select, .helpproduct-primary .price, .helpproduct-primary .qty', function(e) {
        calcTotals();
        return false;
    })
	
	
	if(typeof $.validator == 'function') {
		
		$(document).on('keyup', '[data-onlyonfocus]', function () { return false });
		$.validator.addMethod(
			"regex",
			function(value, element, regexp) {
				var re = new RegExp(regexp);
				return this.optional(element) || re.test(value);
			},
			currentLang == 'ge' ? "GE Please check your input format" : "Please check your input format"
		);
		
		
		$.validator.addMethod(
			"requiredIsVisible",
			function(value, element) {
				if(!$(element).is(':visible')) {
					var isValid = true;
				} else if (value == null){
					var isValid = false;
				} else {
					var isValid = value.length > 0;
				}
				return this.optional(element) || isValid;
			},
			currentLang == 'ge' ? "GE Field is required" : "Field is required"
		);
		
		$.validator.addMethod(
			"registerUniqcheck",
			function(value, element) {
				var type = $(element).data('type') || 'email';
				var kkey = 'registerUniqcheck_' + type;
				//console.log('uniqueTrackingNumber',tnumbersCache[value]);
				
				if(type == 'email' && value.search("@") == -1) {
					return true;
				}
				if((type == 'pn' || type == 'phone') && value.length < 4) {
					return true;
				}
				
				if(!(kkey in aCcache)) {
					aCcache[kkey] = {};
				}
				
				if(aCcache[kkey] && typeof aCcache[kkey][value] != 'undefined') {
					return aCcache[kkey][value];
				}
				
				if(xhrs[kkey] && xhrs[kkey].readyState != 4){
					xhrs[kkey].abort();
				}
				
				xhrs[kkey] = $.ajax({
					type: "GET",
					url: "/ajax/registerUniqCheck.cfm",
					async: false, 
					data: "type=" + type + "&data=" + value,
					dataType: "html",
					success: function(msg) {
						response = ( msg == 'true' ) ? true : false;
						aCcache[kkey][value] = response;
					}
				 });
				return this.optional(element) || aCcache[kkey][value];
			},
			function(value, el) {
				var message = currentLang == 'ge' ? ($(el).data('messageGe') || false) : ($(el).data('message') || false)
				if(message) {
					return message;
				}
				return currentLang == 'ge' ? "GE Account with this data is already exists. You can reset your password <a class='labelLink' href='/authenticate/forgot/'>here</a>" : "Account with this data is already exists. You can reset your password <a href='/authenticate/forgot/' class='labelLink'>here</a>";
			}
		);
		
		
		$.validator.addMethod(
			"uniqueTrackingNumber", 
			function(value, element) {
				//console.log('uniqueTrackingNumber',tnumbersCache[value]);
				if(typeof tnumbersCache[value] != 'undefined') {
					return tnumbersCache[value];
				}
				if(xhrTnU && xhrTnU.readyState != 4){
					xhrTnU.abort();
				}
				xhrTnU = $.ajax({
					type: "GET",
					url: "/ajax/trackingnum.cfm",
					async: false, 
					data: "trackingnum=" + value,
					dataType:"html",
					success: function(msg) {
						response = ( msg == 'true' ) ? true : false;
						//console.log('resp', response, msg);
						tnumbersCache[value] = response;
					}
				 });
				 
				return this.optional(element) || tnumbersCache[value];
			},
			currentLang == 'ge' ? "GE Tracking Number is Already Exists" : "Tracking Number is Already Exists"
		);
		
		$.validator.addMethod(
			"uniqueTrackingNumber2", 
			function(value, element) {
				//console.log('uniqueTrackingNumber2',tnumbersCache2[value]);
				if(typeof tnumbersCache2[value] != 'undefined') {
					return tnumbersCache2[value];
				}
				if(xhrTnU && xhrTnU.readyState != 4){
					xhrTnU.abort();
				}
				xhrTnU = $.ajax({
					type: "GET",
					url: "/ajax/trackingnum.cfm",
					async: false, 
					data: "u=1&trackingnum=" + value,
					dataType:"html",
					success: function(msg) {
						response = ( msg == 'true' ) ? true : false;
						
						if(msg != 'true' && msg != 'false') {
							location.href = '/account/parcels/update.html?id=' + msg
						}
						//console.log('resp', response, msg);
						tnumbersCache2[value] = response;
					}
				 });
				 
				return this.optional(element) || tnumbersCache2[value];
			},
			currentLang == 'ge' ? "GE Tracking Number is Already Exists" : "Tracking Number is Already Exists"
		);
		
		$.validator.addMethod(
			"checkPrivate", 
			function(value, element) {
				if(getParcelType() != 'business') {
					var re = new RegExp(/^[0-9]{11}$/)
					return this.optional(element) || re.test(value);
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "Must be 11 digit number" : "Must be 11 digit number"	
		);
		
		$.validator.addMethod(
			"checkPhoneNumber", 
			function(value, element) {
				var re = new RegExp(/^[0-9\-\+\s\(\)]*$/)
				return this.optional(element) || re.test(value);
			},
			currentLang == 'ge' ? "Please enter a valid phone number" : "Please enter a valid phone number"	
		);
		
		$.validator.addMethod(
			"checkOnePhone", 
			function(value, element) {
				if($('#billing_phone').val() == '' &&
					$('#billing_phone2').val() == '') {
					return false;
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "Fill in at least one number" : "Fill in at least one number"	
		);
		
		$.validator.addMethod(
			"checkTax", 
			function(value, element) {
				if(getParcelType() == 'business') {
					var re = new RegExp(/^[0-9]{9}$/)
					return this.optional(element) || re.test(value);
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "Must be 9 digit number" : "Must be 9 digit number"
		);
		$.validator.addMethod(
			"checkStore", 
			function(value, element) {
				if(getParcelType() != 'personal' && value.trim() == '') {
					return false;
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "გთხოვთ შეავსეთ ეს ველი" : "Please fill out this field"
				
		);
		$.validator.addMethod(
			"checkUploadInvoice", 
			function(value, element) {
				// console.log('checkUploadInvoice value: ', value);
				var $valueElement = $('#value');
				if(showUploadInvoice() && $valueElement.val() >= 110 && value.trim() == '') {
					return false;
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "გთხოვთ შეავსეთ ეს ველი" : "Please fill out this field"
		);
		


		$.validator.addMethod(
			"checkTrackingNumber", 
			function(value, element) {
				//console.log('checkTrackingNumber');
				if(value.cleanup().length > 6) {
					return false;
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "GE No 6 or more letters are allowed" : "No 6 or more letters are allowed"
		);
		
		
		$.validator.addMethod(
			"checkContentsother", 
			function(value, element) {
				if($('#contents').get(0) && ($('#contents').val() == 'Other' 
					|| $('#contents').val() == '') && $('#contentsother').val() == '') {
					return false;
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "გთხოვთ შეავსეთ ეს ველი" : "Please fill out this field"
		);
		
		$.validator.addMethod(
			"checkPasswordFields", 
			function(value, element) {
				if($('#settings_password').val() != '' &&
					($('#settings_passwordcurrent').val() == '' ||
					$('#settings_passwordverify').val() == '')
				) {
					return false;
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "GE Fill in the field for the password change" : "Fill in the field for the password change"
		);
		
		$.validator.addMethod(
			"USCheckCountry", 
			function(value, element) {
				if($(element).closest('form').find('.countrySelect').val() == 'US'
					&& value == '') {
					return false;
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "გთხოვთ შეავსეთ ეს ველი" : "Please fill out this field"
		);
		  	
		$.validator.addMethod(
			"GECheckCountry", 
			function(value, element) {
				if($(element).closest('form').find('.countrySelect').val() == 'GE'
					&& value == '') {
					return false;
				}
				return this.optional(element) || true;
			},
			currentLang == 'ge' ? "გთხოვთ შეავსეთ ეს ველი" : "Please fill out this field"
		);
		    	
		$.validator.addMethod(
			"checkTnLength", 
			function(value, element) {
				//console.log('checkTnLength', (value.length >= 6 && value.length <= 30));
				return this.optional(element) || (value.length >= 6 && value.length <= 35);
			},
			currentLang == 'ge' ? "GE Must be between 6 and 35 characters" : "Must be between 6 and 35 characters"
		);	
    	
		$.validator.addMethod(
			"checkOnlyDigitsChar", 
			function(value, element, regex) {
				var regEx = new RegExp(/^[0-9A-Za-z\-]+$/);
				return regEx.test(value) || this.optional(element);
			},
			currentLang == 'ge' ? "GE Must be only numbers and letters" : "Must be only numbers and letters"
		);
		
		
		$('input.trackingnum').on('keyup', function(){
		   var self = $(this);
			
		   var removedText = self.val().replace(/[^0-9A-Za-z\-]/, '');
		   //console.log(removedText);
		   self.val(removedText);
		});
		
		
		$.validator.addMethod(
			"checkReceiver", 
			function(value, element, regex) {
				var isUniq = isReceiverUniq();
				return isUniq || this.optional(element);
			},
			currentLang == 'ge' ? "GE You already have the receiver with this name and city" : "You already have the receiver with this name and city"
		);
		
	
		   
		
		$.validator.addClassRules({ 
			//trackingnum 				: { regex: /[a-zA-Z]{0,4}/ },
			checkReceiver 			: {checkReceiver: true },
			requiredIsVisible 			: {requiredIsVisible: true },
			checkOnlyDigitsChar 		: {checkOnlyDigitsChar: true },
			uniqueTrackingNumber 		: {uniqueTrackingNumber: true },
			checkUploadInvoice 			: {checkUploadInvoice: true},
			checkPrivate 				: {checkPrivate: true},
			checkTax 					: {checkTax: true},   
			checkOnePhone 				: {checkOnePhone: true},   
			checkPasswordFields 		: {checkPasswordFields: true},   
			checkTrackingNumber 		: {checkTrackingNumber: true}, 
			checkStore 					: {checkStore: true}, 
			GECheckCountry 				: {GECheckCountry: true},
			USCheckCountry 				: {USCheckCountry: true}    
		});
		
		$.validator.setDefaults({
			onkeyup: function(element) { 
				console.log('onlyonfocus', element);
				console.log('onlyonfocus2', $(element).data('onlyonfocus'));
				if ($(element).data('onlyonfocus')) { 
					return false; 
				}
			}
		});
		

		if($('input[name=parceltype]').get(0)) {
			//parcelType = 
			checkParcelType()
			$('input[name=parceltype]').on('ifChecked', function(event){
				checkParcelType();
			});
		}
	}

	//2016.12.20
	$('.loginmodal').click(function() {
		$('.login-link').click();
		return false;
	})
	
	morePage = 0;
	$('.moreCoupons a').click(function() {
		var $this = $(this).parents('.moreCoupons'), 
			next = $this.siblings('.coupon-list-inner:not(.hide)').last().next();
		next.slideDown(function() {
			next.removeClass('hide');
			if($this.siblings('.coupon-list-inner.hide').length == 0) {
				$this.fadeOut();
			}
		});
	
		
		
		return false;
	})
	
	
	
	toggleUploadInvoice();
	$('[name="value"]').on('change keyup', function() {
		toggleUploadInvoice();
	})
});

function showUploadInvoice() {
	var value = parseFloat($('[name="value"]').val()) || 1;
	
	var rate = typeof lariRate != 'undefined' ? lariRate : 1;
	
	return value >= ((0 / rate) * 0.9);
	//return value >= 300 / rate;
}
function toggleUploadInvoice() {
	if(showUploadInvoice()) {
		$('.upload-invoice').removeClass('hide');
	} else {
		$('.upload-invoice').addClass('hide');
	}
}

function checkParcelType() {
	var $pt = getParcelType();
	$('.pt-filter:not(.pt-' + $pt + ')').hide();
	if($pt == false) {
		$('.pt-filter.pt-default').show();
	} else {
		$('.pt-filter.pt-' + $pt).show();
	}
}

function getParcelType() {
	if($('input[name=parceltype]:checked').length == 0) {
		return false;
	}
	/*
		$('input[name=parceltype][value=Personal]').iCheck('check').prop('checked', true);
	*/
	return $pt = $('input[name=parceltype]:checked').val().toLowerCase();
}

function calcTotals() {
    var total = 0;
    $('.calc-fields:visible').each(function(k, v) {
        var exchangeRate = $(v).find('.currency').val() != 'USD' ? $('#exchangeRate').val() : 1;
        
        total += parseInt($(v).find('.price').val()) * parseInt($(v).find('.qty').val() * exchangeRate);
    });
    
    $('.helptoshop-total-input').val(total.formatMoney(2));
    $('.helptoshop-total span').html(total.formatMoney(2));
}

function addProduct() {
    var productHTML = $('.templates .product').html() , productIndex = $('.helptoshop-products > .helpproduct-primary').length + 1;
    $('.helptoshop-products').append(productHTML.replaceAll('{n}', productIndex));
    
    $('#product' + productIndex + ' select').select2({
        minimumResultsForSearch: Infinity
    });
    
}

function addProductComment(e) {
    var productCommentHTML = $('.templates .comment-field').html(), 
        container = $(e.target).closest('.helpproduct-primary');
    if(container.find('.input-group-comment').length == 0) {
        container.find('.helpproduct-remove').before(productCommentHTML.replaceAll('{n}', container.data('id')));
    }
}

function addOption(parentId) {
    var productoptionHTML = $('.templates .product-option').html(), 
    productOptionIndex = $('#product' + parentId + ' .options > .helpproduct-option').length + 1;
    $('#product' + parentId + ' .options')
        .append(productoptionHTML.replaceAll('{oid}', productOptionIndex).replaceAll('{n}', parentId));
    $('#product' + parentId + ' .options select').select2({
        minimumResultsForSearch: Infinity
    });
}

function addOptionComment(e) {
    var productCommentHTML = $('.templates .comment-field-option').html(), 
        container = $(e.target).closest('.helpproduct-primary'),
        containerOption = $(e.target).closest('.helpproduct-option');
    if(containerOption.find('.input-group-comment-option').length == 0) {
        containerOption.find('.remove_option')
            .before(productCommentHTML.replaceAll('{oid}', containerOption.data('oid')).replaceAll('{n}', container.data('id')));
    }
}

function removeProduct(e) {
    $(e.target).closest('.helpproduct-primary').remove();
}

function removeOption(e) {
    $(e.target).closest('.helpproduct-option').remove();
}

function sleepf(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}