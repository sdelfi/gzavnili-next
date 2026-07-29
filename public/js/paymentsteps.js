 var selectedparcels, globalIncrement = 1;
 jQuery(function () {
	 if(jQuery('body').width() <= 991) {
		 
		 jQuery('html, body').animate({
			scrollTop: $(".paymentsteps div.left").offset().top
		 }, 1000);
	 }
	 
	 
     initSelect2();
     prepareParcelList();
     jQuery('body').on('change', '.parcel-select2', prepareParcelList);

     var psNewList = '';
	 if(typeof psParcels != 'undefined') {
		 jQuery.each(psParcels, function (trackingNum, v) {
			 psNewList += '<option value="' + trackingNum + '" selected="selected">' + trackingNum + '</option>';
		 })
	 }
	 
	 //For cc card input formatter
	if(typeof $.fn.payment == 'function') {
		$('[name=cardnumber]').payment('formatCardNumber');
		$('[name=expirydate]').payment('formatCardExpiry');
		$('[name=cvvcode]').payment('formatCardCVC');
	}
	

     jQuery('.parcel-select2').each(function (k, v) {
         jQuery(v).append(psNewList);
     }).trigger('change');
	 //prepareParcelList();
	 
     jQuery('body').on('click', '.removeaddress', function () {
         var currentBox = jQuery(this).closest('.address-box');
         currentBox.remove();
         prepareParcelList();
         prepareAddressBoxes();
		 checkDeliveryRequestCount();
         if (jQuery('.address-box').length < 3) {
              jQuery('.addaddress').fadeIn();
         }
         return false;
     })
	 
	 console.log('checked');
	 checkCCRequired();
	 jQuery('[name=ptype]').on('change ifToggled', function() {
		 checkCCRequired();
	 })	 
	 
	 checkDeliveryType();
	 jQuery('[name=deliverytype]').on('change ifToggled', function() {
		 checkDeliveryType();
	 })
	checkDeliveryRequestCount();
     jQuery('.addaddress').click(function () {
         jQuery('.parcel-select2').select2('destroy');
         jQuery('.address-box select').not('.parcel-select2').select2('destroy');
         var cloned = jQuery('.address-box').last().clone();
         //cloned = prepareAddressBox(cloned);
         cloned.insertAfter(jQuery('.address-box').last())
			.find('.toparcels option').prop('selected', false); 
         initSelect2();
		 checkDeliveryRequestCount();
         prepareAddressBoxes();
         prepareParcelList();
		 
		 jQuery('.address-box').last().find('.parcel-select2 option').each(function(k, option) {
			 if(jQuery(option).prop('disabled') == false) {
				 jQuery(option).prop('selected', true);
			 }
		 }).trigger('change');
		 
         if (jQuery('.address-box').length == 3) {
             jQuery(this).fadeOut();
         }
         return false;
     })
 })

 function checkDeliveryType() {
	 if(jQuery('[name=deliverytype]:checked').val() == 1) {
		if(jQuery('.address-box').length > 1) { 
			jQuery('.address-box').each(function(k, v) {
				if(k == 0) {
					return;
				}
				jQuery(v).find('.removeaddress').click();
			})
		}
		jQuery('.addaddress').hide();
	 } else {
		if(jQuery('.address-box').length != 3) {
			jQuery('.addaddress').show();
		}
	 }
 }
 
 function checkDeliveryRequestCount() {
	 jQuery('.delivery-places').text(jQuery('.address-box').length);
	 
 }
 
 function checkCCRequired() {
	 console.log(jQuery('[name=ptype]:checked').val() == 1);
	 if(jQuery('[name=ptype]:checked').val() == 1) {
		 jQuery('[name=ptype][value=1]').closest('.item').find('.form-control').attr('required', 'required');
	 } else {
		 jQuery('[name=ptype][value=1]').closest('.item').find('.form-control').attr('required', false);
	 }
 }
 
 function initSelect2() {
     jQuery('.parcel-select2').select2({
         placeholder: "Select parcel"
     });   
	 
	 jQuery('.address-box select').not('.parcel-select2').select2({
         minimumResultsForSearch: Infinity
     });
 }

 function prepareAddressBox(newP) {
     var last = jQuery('.address-box').last();
     newP.find('span.num').text(parseInt(last.find('span.num').text()) + 1);

     return newP;
 }


 function prepareAddressBoxes() {
     jQuery('.address-box').each(function (k, v) {
         var num = k + 1;
         jQuery(v).find('span.num').text(num);
		 
		 
		 if(num !== 1) {
			 jQuery(v).find('[data-name]:input').each(function(fkey, field) {
				 jQuery(field).prop('name', jQuery(field).data('name') + num);
			 })
		 }
     })
 }


 function prepareParcelList() {
     selectedparcels = [];

     jQuery('.parcel-select2').each(function (k, v) {
         var table = jQuery(v).closest('.address-box').find('.parcelList');
         table.empty();
         jQuery(v).find(':selected').each(function (oK, oV) {
             var selectedVal = jQuery(oV).val();
             table.append('<tr><td>' + selectedVal + '</td><td>' + psParcels[selectedVal].weight + '</td></tr>');
             selectedparcels.push(selectedVal);
         })
     })

     jQuery('.parcel-select2').each(function (k, v) {
         jQuery(v).find('option').not(':selected').each(function (oK, oV) {
             var selectedVal = jQuery(oV).val();
             //console.log(oV);
             if (jQuery.inArray(selectedVal, selectedparcels) >= 0) {
                 jQuery(oV).prop('disabled', true);
             } else {
                 jQuery(oV).prop('disabled', false);
             }
         })
         jQuery(v).select2();
     })

     if (jQuery('.address-box').length == 1) {
         jQuery('.removeaddress').fadeOut();
     } else {
         jQuery('.removeaddress').fadeIn();
     }
 }