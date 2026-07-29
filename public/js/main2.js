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
    tnumbersCache = {};

$(document).ready(initPage);


function initPage(){    
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
        $(this).parent().siblings().removeClass('active');
        $(this).parent().toggleClass('active');
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
    });

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

} // end initPage

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



// New from Stas
$(function() {
    //Initiall adding
    if($('.templates .product').get(0)) {
        addProduct();
    }
    
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
        $.validator.addMethod(
            "regex",
            function(value, element, regexp) {
                var re = new RegExp(regexp);
                return this.optional(element) || re.test(value);
            },
            currentLang == 'ge' ? "GE Please check your input format" : "Please check your input format"
        );
        $.validator.addMethod(
            "uniqueTrackingNumber", 
            function(value, element) {
                console.log('uniqueTrackingNumber',tnumbersCache[value]);
                if(typeof tnumbersCache[value] != 'undefined') {
                    return tnumbersCache[value];
                }
                
                $.ajax({
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
                if(getParcelType() != 'personal' && value == '') {
                    return false;
                }
                return this.optional(element) || true;
            },
            currentLang == 'ge' ? "Fill in at least one number" : "Fill in at least one number" 
        );
        
        $.validator.addMethod(
            "checkTrackingNumber", 
            function(value, element) {
                //console.log('checkTrackingNumber');
                if(value.cleanup().length > 4) {
                    return false;
                }
                return this.optional(element) || true;
            },
            currentLang == 'ge' ? "GE No 4 or more letters are allowed" : "No 4 or more letters are allowed"
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
            currentLang == 'ge' ? "áƒ’áƒ—áƒ®áƒáƒ•áƒ— áƒ¨áƒ”áƒáƒ•áƒ¡áƒ”áƒ— áƒ”áƒ¡ áƒ•áƒ”áƒšáƒ˜" : "Please fill out this field"
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
            currentLang == 'ge' ? "áƒ’áƒ—áƒ®áƒáƒ•áƒ— áƒ¨áƒ”áƒáƒ•áƒ¡áƒ”áƒ— áƒ”áƒ¡ áƒ•áƒ”áƒšáƒ˜" : "Please fill out this field"
        );
                
        $.validator.addMethod(
            "checkTnLength", 
            function(value, element) {
                //console.log('checkTnLength', (value.length >= 6 && value.length <= 30));
                return this.optional(element) || (value.length >= 6 && value.length <= 30);
            },
            currentLang == 'ge' ? "GE Must be between 6 and 30 characters" : "Must be between 6 and 30 characters"
        );  
        
        $.validator.addMethod(
            "checkOnlyDigitsChar", 
            function(value, element, regex) {
                var regEx = new RegExp(/[0-9A-Za-z]+/);
                return this.optional(element) || regEx.test(value);
            },
            currentLang == 'ge' ? "GE Must be only numbers and letters" : "Must be only numbers and letters"
        );
          
        
        $.validator.addClassRules({ 
            //trackingnum               : { regex: /[a-zA-Z]{0,4}/ },
            checkOnlyDigitsChar         : {checkOnlyDigitsChar: true },
            uniqueTrackingNumber        : {uniqueTrackingNumber: true },
            checkPrivate                : {checkPrivate: true},
            checkTax                    : {checkTax: true},   
            checkOnePhone               : {checkOnePhone: true},   
            checkPasswordFields         : {checkPasswordFields: true},   
            checkTrackingNumber         : {checkTrackingNumber: true}, 
            checkStore                  : {checkStore: true}, 
            GECheckCountry              : {GECheckCountry: true},
            USCheckCountry              : {USCheckCountry: true}    
        });
        
        if($('input[name=parceltype]').get(0)) {
            //parcelType = 
            checkParcelType()
            $('input[name=parceltype]').on('ifChecked', function(event){
                checkParcelType();
            });
        }
    }
    
});

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