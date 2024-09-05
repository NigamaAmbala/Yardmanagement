sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/format/DateFormat"
],
function (Controller,JSONModel, Fragment, Filter, FilterOperator, MessageBox, MessageToast, DateFormat) {
    "use strict";

    return Controller.extend("com.app.yardmanagement.controller.Dashboard", {
        onInit: function () {
            var oModel = new JSONModel(sap.ui.require.toUrl("com/app/yardmanagement/model/data.json"));
            this.getView().setModel(oModel);
            var oModel = this.getOwnerComponent().getModel();
            this.getView().byId("pageContainer").setModel(oModel);

            this._setParkingLotModel(); 

            const oLocalModel = new JSONModel({
                VDETAILS: {
                    Vehicleno: "",
                    Processtype:"",
                    Drivername: "",
                    Phonenumber: "",
                    Vehicletype: "",
                    Intime: "",
                    Outtime: "",
                    Parkinglot: "",
                },
                Parkingslots: {
                    Status : "Occupied"
                }
            });

            this.getView().setModel(oLocalModel, "localModel");

            var today = new Date();  // Get the current date

            // Get the date picker element by its ID ("InputEstimatedtime")
            var oDateTimePicker = this.getView().byId("InputEstimatedtime");

            // Set the minimum date for the date picker to today's date
            oDateTimePicker.setMinDate(today);
            


        },
        onItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            this.byId("pageContainer").to(this.getView().createId(oItem.getKey()));
        },

        onSideNavButtonPress: function () {
            var oToolPage = this.byId("toolPage");
            var bSideExpanded = oToolPage.getSideExpanded();

            this._setToggleButtonTooltip(bSideExpanded);

            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        _setToggleButtonTooltip: function (bLarge) {
            var oToggleButton = this.byId('sideNavigationToggleButton');
            if (bLarge) {
                oToggleButton.setTooltip('Large Size Navigation');
            } else {
                oToggleButton.setTooltip('Small Size Navigation');
            }
        },
        onAssignPressbtn: async function () {
            debugger;
            var oView = this.getView();
            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
            });
 
            var currentDate = new Date(); // Current system date and time
            var formattedDateTime = oDateFormat.format(currentDate);
            const oPayload = this.getView().byId("page2").getModel("localModel").getProperty("/");
            //oPayload.plotNo.Status = 'Occupied';
            const { Drivername, Phonenumber, Vehicleno, Vehicletype , Processtype} = this.getView().byId("page2").getModel("localModel").getProperty("/").VDETAILS;
            const oModel = this.getView().byId("pageContainer").getModel(); // Assuming "ModelV2" is your ODataModel
           const plotNo = this.getView().byId("idparkingLotSelect").getValue();
           const oProcesstype = this.getView().byId("idselectvt").getSelectedKey();
           oPayload.VDETAILS.Processtype = oProcesstype
           oPayload.VDETAILS.Parkinglot = plotNo
            oPayload.VDETAILS.Intime = formattedDateTime;

            if (!/^\d{10}$/.test(oPayload.VDETAILS.Phonenumber)) {
                this.getView().byId("driverPhoneInput").setValueState("Error").setValueStateText("Mobile number must be a '10-digit number'.");
                return;
            } else {
                this.getView().byId("driverPhoneInput").setValueState("None");
            }

            if (!/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/.test(oPayload.VDETAILS.Vehicleno)) {  // Example format: XX00XX0000
                this.getView().byId("idvehiclenoInput12").setValueState("Error").setValueStateText("Vehicle number format Should be like this 'AP21BE5678'.");
                return;
            } else {
                this.getView().byId("idvehiclenoInput12").setValueState("None");
            } 

            var oVehicleExist = await this.checkVehicleNo(oModel, oPayload.VDETAILS.Vehicleno)
            if (oVehicleExist) {
                MessageToast.show("Vehicle already exsist")
                return
            };

            var bDriverNumberExists = await this.checkIfExists(oModel, "/VDEATILSSet", "Phonenumber", oPayload.VDETAILS.Phonenumber);
            var plotAssigned = await this.checkIfExists(oModel, "/VDEATILSSet", "Parkinglot", oPayload.VDETAILS.Parkinglot);
        
            if (bDriverNumberExists || plotAssigned) {
                MessageBox.error(" plot Number or Phone number already assigned ");
                return;
            }
            
            try {
                // Assuming createData method sends a POST request
 
                await this.createData(oModel, oPayload.VDETAILS, "/VDEATILSSet")

                var sPath = this.byId("idparkingLotSelect").getSelectedItem().getBindingContext().getPath();
                    const updatedParkingLot = {
                        Parkinglot: plotNo,
                        Status: "Occupied", // Assuming false represents empty parking
                        Processtype:oProcesstype
                    };
                    oModel.update(sPath, updatedParkingLot, {
                        success: function () {
                            sap.m.MessageToast.show(`${Vehicleno} allocated to Slot No ${plotNo}`);
                        }.bind(this),
                        error: function (oError) {
                            sap.m.MessageBox.error("Failed to update: " + oError.message);
                        }.bind(this)
                    });
            
               //   start SMS
               const accountSid = "ACfcd333bcb3dc2c2febd267ce455a6762"
               const authToken = "687323f325394ff3b30f44a83444c2b2"

               // debugger
               const toNumber = `+91${Phonenumber}`
               const fromNumber = '+13613109079';
               const messageBody = `Hello ${Drivername},\n\nYour vehicle with Vehicle number ${Vehicleno} is allocated to the Slot ${plotNo}.`;


               // Twilio API endpoint for sending messages
               const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;


               // Send POST request to Twilio API using jQuery.ajax
               $.ajax({
                   url: url,
                   type: 'POST',
                   async: true,
                   headers: {
                       'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken)
                   },
                   data: {
                       To: toNumber,
                       From: fromNumber,
                       Body: messageBody
                   },
                   success: function (data) {
                       MessageToast.show('if number exists SMS will be sent!');
                   },
                   error: function (error) {
                       MessageToast.show('Failed to send SMS: ' + error);
                   }
               });

               // sms endR

            } catch (error) {
                console.error("Error:", error);
            }
            this.printAssignmentDetails();
            this.onclearPress1();
 
            // var sMessage = `Hello, ${Drivername} your vehicle with vehicle number:${Vehicleno}  is allocated to slot number:${plotNo}`
            // this.onSms(phone, sMessage);
 
        },
        checkIfExists: async function (oModel, sEntitySet, sProperty, sValue) {
            return new Promise((resolve, reject) => {
                oModel.read(sEntitySet, {
                    filters: [new sap.ui.model.Filter(sProperty, sap.ui.model.FilterOperator.EQ, sValue)],
                    success: (oData) => {
                        resolve(oData.results.length > 0);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },
        checkVehicleNo: async function (oModel, sVehicleNo) {
            debugger
            return new Promise((resolve, reject) => {
                oModel.read("/VDEATILSSet", {
                    filters: [
                        new Filter("Vehicleno", FilterOperator.EQ, sVehicleNo),
                    ],
                    success: function (oData) {
                        resolve(oData.results.length > 0)
                    },
                    error: function () {
                        reject("An error occurred while checking vehicle existence.");
                    }
                });
            });
        },

        onclearPress1: function () {
            var oView = this.getView();
            var sVehicleNo = oView.byId("idvehiclenoInput12").setValue();
            var sDriverName = oView.byId("driverNameInput").setValue();
            var sPhoneNo = oView.byId("driverPhoneInput").setValue();
            var sProcesstype = oView.byId("idselectvt").setValue();
            var sVehicleType = oView.byId("vehicletypeInput").setValue();
            var sParkingLot = oView.byId("idparkingLotSelect").setValue();
        },
        
        vehiclenumber: function (oEvent) {
            debugger
            var that = this
            const oView = this.getView()
            var oLocalModel = this.getView().byId("page2").getModel("localModel");
            var sVehicleNo = oEvent.getParameter("value");
            var oModel = this.getView().byId("pageContainer").getModel();

            oModel.read("/VDEATILSSet", {
                filters: [
                    new Filter("Vehicleno", FilterOperator.EQ, sVehicleNo)
                ],
                success: function (oData) {
                    var aVehicles = oData.results;
                    if (aVehicles.length > 0) {
                        // Assuming there's only one record with unique vehicalNo

                        var oVehicle1 = aVehicles.filter(checkVehicle)
                        function checkVehicle(v) {
                            console.log(v)
                            return v.Vehicleno === sVehicleNo;
                        }
                        console.log(oVehicle1)

                        var oVehicle = oVehicle1[0];
                        // Set other fields based on the found vehicle
                        oLocalModel.setProperty("/VDETAILS/Vehicleno", oVehicle.Vehicleno);
                        oLocalModel.setProperty("/VDETAILS/Drivername", oVehicle.Drivername);
                        oLocalModel.setProperty("/VDETAILS/Phonenumber", oVehicle.Phonenumber);
                        oLocalModel.setProperty("/VDETAILS/Processtype", oVehicle.Processtype);
                        oLocalModel.setProperty("/VDETAILS/Vehicletype", oVehicle.Vehicletype);
                        oLocalModel.setProperty("/VDETAILS/Intime", oVehicle.Intime);
                        oLocalModel.setProperty("/VDETAILS/Parkinglot", oVehicle.Parkinglot);
                        this.oView.byId("idparkingLotSelect").setValue(oVehicle.Parkinglot);
                        this.oView.byId("idselectvt").setValue(oVehicle.Processtype)
                        // oView.byId("idAlotVehicle").setVisible(true);
                        // oView.byId("idAlotProcess").setVisible(true);
                        // oView.byId("idVehicleType").setVisible(false);
                        // oView.byId("idProcessType").setVisible(false);
                        // oView.byId("idAlotVehicle").setText(oVehicle.Vehicletype);
                        // oView.byId("productInput").setValue(oVehicle.Parkinglot);
                        // Set other fields as needed
                    } else {
                        // Handle case where vehicle number was not found
                        sap.m.MessageToast.show("Vehicle number not found.");
                        // Optionally clear other fields
                        oLocalModel.setProperty("/VDETAILS/Vehicleno", "");
                        oLocalModel.setProperty("/VDETAILS/Drivername", "");
                        oLocalModel.setProperty("/VDETAILS/Phonenumber", "");
                        oLocalModel.setProperty("/VDETAILS/Processtype", "");
                        oLocalModel.setProperty("/VDETAILS/Vehicletype", "");
                        oLocalModel.setProperty("/VDETAILS/Intime", "");
                        // Clear other fields as needed
                    }
                }.bind(this),
                error: function (oError) {
                    sap.m.MessageToast.show("Error fetching vehicle details: " + oError.message);
                }

            });
        },

        onUnassignPressbtn: async function () {
            try {
                const oPayload = this.getView().byId("page2").getModel("localModel").getProperty("/");
                const { Drivername, Phonenumber, Vehicleno, Vehicletype , Intime, Processtype} = oPayload.VDETAILS;
                const oModel = this.getView().byId("pageContainer").getModel();
                const plotNo = this.getView().byId("idparkingLotSelect").getValue();
                oPayload.VDETAILS.Parkinglot = plotNo;
                // const oProcesstype = this.getView().byId("idselectvt").getValue();
                // oPayload.VDETAILS.Processtype = oProcesstype

                var oDateFormat = DateFormat.getDateTimeInstance({
                    pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
                });
     
                var currentDate = new Date(); // Current system date and time
                var formattedDateTime = oDateFormat.format(currentDate);

                oPayload.VDETAILS.Outtime = formattedDateTime;

                var oHID = await this.generateUUID();

                const oHistory = {

                    Historyid: oHID,
                    Vehicleno: Vehicleno,
                    Processtype: Processtype,
                    Drivername: Drivername,
                    Phonenumber: Phonenumber,
                    Vehicletype: Vehicletype,
                    Intime: Intime,
                    Outtime: formattedDateTime,
                    Parkinglot: plotNo
                }


                //create history
                await this.createData(oModel, oHistory, "/historySet");
                

                // Unassign the vehicle from the plot
                await this.deleteData(oModel, "/VDEATILSSet", Vehicleno);

                //sap.m.MessageBox.success(`Vehicle ${Vehicleno} unassigned successfully. Parking lot ${plotNo} is empty.`);

                const updatedParkingLot = {
                    Parkinglot: plotNo,
                    Status: "AVAILABLE", // Assuming false represents empty parking
                };
                oModel.update("/ParkingslotsSet('" + plotNo + "')", updatedParkingLot, {

                    success: function () {
                        sap.m.MessageBox.success(`Vehicle ${Vehicleno} unassigned successfully. Parking lot ${plotNo} is empty.`);
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to update parking lot: " + oError.message);
                    }
                });

                // Clear fields or perform any necessary actions
                this.onclearPress1();

            } catch (error) {
                console.error("Error:", error);
                sap.m.MessageBox.error("Failed to unassign vehicle: " + error.message);
            }
        },

        generateUUID: function () {
            debugger
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        onServiceTypeChange: function (oEvent) {
            // Get the selected service type from the dropdown
            var sServiceType = oEvent.getSource().getSelectedKey();
     
            // Get the reference to the slots dropdown (Combobox)
            var oSlotsComboBox = this.getView().byId("idparkingLotSelect");
     
            // Create filters based on selected service type and available status
            var aFilters = [
              new sap.ui.model.Filter("Processtype", sap.ui.model.FilterOperator.EQ, sServiceType),
              new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "AVAILABLE")
            ];
     
            // Apply the filters to the items aggregation of the slots dropdown
            oSlotsComboBox.bindAggregation("items", {
              path: "/ParkingslotsSet",
              template: new sap.ui.core.Item({
                key: "{Parkinglot}",
                text: "{Parkinglot}"
              }),
              filters: aFilters
            });
          },

          onServiceTypeChangeR: function (oEvent) {
            // Get the selected service type from the dropdown
            var sServiceType = oEvent.getSource().getSelectedKey();
     
            // Get the reference to the slots dropdown (Combobox)
            var oSlotsComboBox = this.getView().byId("idparkingLotSelect1");
     
            // Create filters based on selected service type and available status
            var aFilters = [
              new sap.ui.model.Filter("Processtype", sap.ui.model.FilterOperator.EQ, sServiceType),
              new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "AVAILABLE")
            ];
     
            // Apply the filters to the items aggregation of the slots dropdown
            oSlotsComboBox.bindAggregation("items", {
              path: "/ParkingslotsSet",
              template: new sap.ui.core.Item({
                key: "{Parkinglot}",
                text: "{Parkinglot}"
              }),
              filters: aFilters
            });
          },
        //    
        onEdit: function () {
            var oTable = this.byId("idAllocatedSlots");
            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
                sap.m.MessageToast.show("Please select a slot to edit.");
                return;
            }
            var aCells = oSelectedItem.getCells();
            var oContext = oSelectedItem.getBindingContext();
            var oData = oContext.getObject();
            var sServiceType = oData.Processtype; // Get the service type of the selected item

            // Filter the ComboBox items based on the service type
            var oVBox = aCells[0]; // Assuming the ComboBox is in the first cell (Slot Number column)
            var oComboBox = oVBox.getItems()[1];
            this._filterAvailableSlotsByServiceType(oComboBox, sServiceType);

            // Make the ComboBox visible for editing
            aCells.forEach(function (oCell) {
                var aItems = oCell.getItems ? oCell.getItems() : [];
                aItems.forEach(function (oItem) {
                    if (oItem instanceof sap.m.Text) {
                        oItem.setVisible(false); // Hide text items
                    } else if (oItem instanceof sap.m.Input || oItem instanceof sap.m.ComboBox) {
                        oItem.setVisible(true); // Show input or combo box
                    }
                });
            });

            this.byId("editButton").setVisible(false);
            this.byId("saveButton").setVisible(true);
            this.byId("cancelButton").setVisible(true);
        },
        _filterAvailableSlotsByServiceType: function (oComboBox, sServiceType) {
            var oModel = this.getView().getModel();
            var aFilters = [
                new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "AVAILABLE"),
                new sap.ui.model.Filter("Processtype", sap.ui.model.FilterOperator.EQ, sServiceType)
            ];

            oComboBox.bindAggregation("items", {
                path: "/ParkingslotsSet",
                template: new sap.ui.core.Item({
                    key: "{Parkinglot}",
                    text: "{Parkinglot}"
                }),
                filters: aFilters
            });
        },
        onCancel: function () {
            var oTable = this.byId("idAllocatedSlots");
            var aSelectedItems = oTable.getSelectedItems();

            aSelectedItems.forEach(function (oItem) {
                var aCells = oItem.getCells();
                aCells.forEach(function (oCell) {
                    var aVBoxItems = oCell.getItems();
                    aVBoxItems[0].setVisible(true); // Show Text
                    aVBoxItems[1].setVisible(false); // Hide Input
                });
            });

            this.byId("editButton").setVisible(true);
            this.byId("saveButton").setVisible(false);
            this.byId("cancelButton").setVisible(false);
        },
        onSave: function () {
            const oView = this.getView();
            const oTable = this.byId("idAllocatedSlots");
            const aSelectedItems = oTable.getSelectedItems();
            const oSelected = oTable.getSelectedItem();

            if (oSelected) {
                const oContext = oSelected.getBindingContext().getObject();
                const sVehicle = oContext.Vehicleno;
                const sTypeofDelivery = oContext.Vehicletype;
                const sProcesstype = oContext.Processtype;
                const sDriverMobile = oContext.Phonenumber;
                const sDriverName = oContext.Drivername;
                var sOldSlotNumber = oContext.Parkinglot;

                // Assuming the user selects a new slot number from somewhere
                const oSelect = oSelected.getCells()[0].getItems()[1]; // Assuming the Select is the second item in the first cell
                const sSlotNumber = oSelect.getSelectedKey(); // Get selected slot number

                var oDateFormat = DateFormat.getDateTimeInstance({
                    pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
                });
     
                var currentDate = new Date(); // Current system date and time
                var formattedDateTime = oDateFormat.format(currentDate);

                // oPayload.VDETAILS.Outtime = formattedDateTime;

                // Create a record in history (assuming this is what you want to do)
                const oNewUpdate = {
                    Vehicleno: sVehicle,
                    Intime: formattedDateTime,
                    Vehicletype: sTypeofDelivery,
                    Processtype:sProcesstype,
                    Drivername: sDriverName,
                    Phonenumber: sDriverMobile,
                    Parkinglot: sSlotNumber
                };

                // Update VDetails record
                const oDataModel = this.getOwnerComponent().getModel();
                oDataModel.update("/VDEATILSSet('" + sVehicle + "')", oNewUpdate, {
                    success: function () {
                        // Update old Parkinglot to empty (parkingType: true -> false)
                        const updatedParkingLot = {
                            Parkinglot: sOldSlotNumber,
                            Status: "AVAILABLE", 
                            Processtype: sProcesstype
                        };
                        oDataModel.update("/ParkingslotsSet('" + sOldSlotNumber + "')", updatedParkingLot, {
                            success: function () {
                                // Update new Parkinglot to occupied (parkingType: false -> true)
                                const updatedNewParkingLot = {
                                    Parkinglot: sSlotNumber,
                                    Status: "Occupied", // Assuming false represents empty parking
                                    Processtype: sProcesstype // Assuming false represents occupied parking
                                };
                                oDataModel.update("/ParkingslotsSet('" + sSlotNumber + "')", updatedNewParkingLot, {
                                    success: function () {
                                        // Refresh table binding or do other necessary actions
                                        oTable.getBinding("items").refresh();
                                        sap.m.MessageBox.success("Slot updated successfully");
                                    },
                                    error: function (oError) {
                                        sap.m.MessageBox.error("Failed to update new slot: " + oError.message);
                                    }
                                });
                            },
                            error: function (oError) {
                                sap.m.MessageBox.error("Failed to update old slot: " + oError.message);
                            }
                        });
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to update VDetails: " + oError.message);
                    }
                });
            }

            // Additional UI updates or actions after saving
            aSelectedItems.forEach(function (oItem) {
                var aCells = oItem.getCells();
                aCells.forEach(function (oCell) {
                    var aVBoxItems = oCell.getItems();
                    aVBoxItems[0].setVisible(true); // Hide Text
                    aVBoxItems[1].setVisible(false); // Show Input
                });
            });
            this.byId("editButton").setVisible(true);
            this.byId("saveButton").setVisible(false);
            this.byId("cancelButton").setVisible(false);
        },
        // for reservations
        onReservePressbtn: async function () {

            const svendorName = this.getView().byId("InputVedorname").getValue();
            const svendorphno = this.getView().byId("InputVedorphno").getValue();
            const svehicleNo = this.getView().byId("InputVehicleno").getValue();
            const sdriverName = this.getView().byId("InputDriverName").getValue();
            const sphoneNumber = this.getView().byId("InputPhonenumber").getValue();
            const svehicleType = this.getView().byId("InputVehicletype").getValue();
            //const sProcessType = this.getView().byId("idprocessselect").getValue();
            const sReservedDate = this.getView().byId("InputEstimatedtime").getValue();

            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
            });
 
            var currentDate = new Date(); // Current system date and time
            var formattedDateTime = oDateFormat.format(currentDate);
 
            const oReserveModel = new JSONModel({

                Reservations: {

                    Vendorname: svendorName,
                    Vendorphno:svendorphno,
                    Vehicleno: svehicleNo,
                    Drivername: sdriverName,
                    Phonenumber: sphoneNumber,
                    Processtype: "",
                    Vehicletype: svehicleType,
                    Reservedtime: formattedDateTime,
                    Parkinglot: "",
                }
            });
            this.getView().setModel(oReserveModel, "reserveModel");
            const oPayload = this.getView().byId("page7").getModel("reserveModel").getProperty("/");
            const oModel = this.getView().byId("pageContainer").getModel();
            const plotNo = this.getView().byId("idparkingLotSelect1").getValue();
            oPayload.Reservations.Parkinglot = plotNo;

            const oprocesstype = this.getView().byId("idprocessselect").getSelectedKey();
            oPayload.Reservations.Processtype = oprocesstype;
 
            // if (!svehicleNo || !svehicleNo.match(/^[\w\d]{1,10}$/)) {
            //     sap.m.MessageBox.error("Please enter a valid vehicle number (alphanumeric, up to 10 characters).");
            //     return;
            // }
 
            const vehicleExists = await this.checkVehicleExists(oModel, svehicleNo);
            if (vehicleExists) {
                sap.m.MessageBox.error("Vehicle number already Assigned. Please enter a different vehicle number.");
                return;
            }
             
            
             //valid phone number
            if (!/^\d{10}$/.test(sphoneNumber)) {
                this.getView().byId("InputPhonenumber").setValueState("Error").setValueStateText("Mobile number must be a '10-digit number'.");
                return;

            } else {
                this.getView().byId("InputPhonenumber").setValueState("None");
            }


            //validate vehicle number
            if (!/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/.test(svehicleNo)) {  // Example format: XX00XX0000
                this.getView().byId("InputVehicleno").setValueState("Error").setValueStateText("Vehicle number format Should be like this 'AP21BE5678'.");
                return;
            } else {
                this.getView().byId("InputVehicleno").setValueState("None");
            }

            var bDriverNumberExists = await this.checkIfExistsReserve(oModel, "/RESERVATIONSSet", "Phonenumber", sphoneNumber);
            var bVehicleNumberExists = await this.checkIfExistsReserve(oModel, "/RESERVATIONSSet", "Vehicleno", svehicleNo);
        
            if (bDriverNumberExists || bVehicleNumberExists) {
                sap.m.MessageBox.error("vehicle number or phone number already reserved.");
                return;
            }
 
 
            var isReserved = await this.checkParkingLotReservation12(oModel, plotNo);
            if (isReserved) {
                sap.m.MessageBox.error(`Parking lot is already reserved. Please select another parking lot.`, {
                    title: "Reservation Information",
                    actions: sap.m.MessageBox.Action.OK
                });
                return;
            }
 
            try {
                // Assuming createData method sends a POST request
                await this.createData(oModel, oPayload.Reservations, "/RESERVATIONSSet");
                
                const updatedParkingLot = {
                     Parkinglot: plotNo,
                     Status: "RESERVED", // Assuming false represents empty parking
                     Processtype:oprocesstype // Assuming false represents empty parking
                    // Add other properties if needed
                };

                //Update parking lot entity
                oModel.update("/ParkingslotsSet('" + plotNo + "')", updatedParkingLot, {
                    success: function () { 
                        sap.m.MessageToast.show(`${svehicleNo} Reserved to Slot No ${plotNo}`);
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to update: " + oError.message);
                    }
                });
 
                // Clear fields or perform any necessary actions

            } catch (error) {
                console.error("Error:", error);
            }

            this.onclearPress12();
 
        },

        onclearPress12: function () {
            var svendorName = this.getView().byId("InputVedorname").setValue();
            var svendorphno = this.getView().byId("InputVedorphno").setValue();
            var svehicleNo = this.getView().byId("InputVehicleno").setValue();
            var sdriverName = this.getView().byId("InputDriverName").setValue();
            var sphoneNumber = this.getView().byId("InputPhonenumber").setValue();
            var svehicleType = this.getView().byId("InputVehicletype").setValue();
            var sprocess = this.getView().byId("idprocessselect").setValue();
            var sReservedDate = this.getView().byId("InputEstimatedtime").setValue();
            var sParkingLot = this.getView().byId("idparkingLotSelect1").setValue();
        },

        checkVehicleExists: async function (oModel, sVehicleNo) {
            return new Promise((resolve, reject) => {
                oModel.read("/VDEATILSSet", {
                    filters: [
                        new Filter("Vehicleno", FilterOperator.EQ, sVehicleNo)
                    ],
                    success: function (oData) {
                        resolve(oData.results.length > 0);
                    },
                    error: function () {
                        reject("An error occurred while checking vehicle number existence.");
                    }
                });
            });
        },
         
        checkPlotAvailability: async function (oModel, plotNo) {
            debugger;
            return new Promise((resolve, reject) => {
                oModel.read("/ParkingslotsSet('" + plotNo + "')",   {
                    success: function (oData) {
                        resolve(oData.parkingType);
                    },
                    error: function (oError) {
                        reject("Error checking plot availability: " + oError.message);
                    }
                });
            });
        },

        checkIfExistsReserve: async function (oModel, sEntitySet, sProperty, sValue) {
            return new Promise((resolve, reject) => {
                oModel.read(sEntitySet, {
                    filters: [new sap.ui.model.Filter(sProperty, sap.ui.model.FilterOperator.EQ, sValue)],
                    success: (oData) => {
                        resolve(oData.results.length > 0);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },
        checkParkingLotReservation12: async function (oModel, plotNo) {
            return new Promise((resolve, reject) => {
                oModel.read("/RESERVATIONSSet", {
                    filters: [
                        new sap.ui.model.Filter("Parkinglot", sap.ui.model.FilterOperator.EQ, plotNo)
                    ],
                    success: function (oData) {
                        resolve(oData.results.length > 0);
                    },
                    error: function () {
                        reject("An error occurred while checking parking lot reservation.");
                    }
                });
            });
        },
       // in reserved slots assign button
        onpressassignrd: async function () {
            debugger
            var oSelected = this.byId("idReserved").getSelectedItems();
            if (oSelected.length === 0) {
                MessageBox.error("Please Select atleast row to Assign");
                return
            };

            var oSelectedRow = this.byId("idReserved").getSelectedItem().getBindingContext().getObject();
            var orow = this.byId("idReserved").getSelectedItem().getBindingContext().getPath();
            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
            });
 
            var currentDate = new Date(); // Current system date and time
            var formattedDateTime = oDateFormat.format(currentDate);
            var resmodel = new JSONModel({

                Vehicleno: oSelectedRow.Vehicleno,
                Drivername: oSelectedRow.Drivername,
                Phonenumber: oSelectedRow.Phonenumber,
                Vehicletype: oSelectedRow.Vehicletype,
                Processtype: oSelectedRow.Processtype,
                Intime: formattedDateTime,
                Parkinglot: oSelectedRow.Parkinglot,

            });
            var temp = oSelectedRow.Parkinglot;

            const oModel = this.getView().byId("pageContainer").getModel();
            debugger
            this.getView().byId("page8").setModel(resmodel, "resmodel");
            this.getView().byId("page8").getModel("resmodel").getProperty("/");

            oModel.create("/VDEATILSSet", resmodel.getData(), {
                success: function (odata) {
                    debugger
                    oModel.remove(orow, {
                        success: function () {
                            oModel.refresh()
                            const updatedParkingLot = {
                                Parkinglot:temp,
                                Status: "Occupied", // Assuming false represents empty parking
                                Processtype:oSelectedRow.Processtype // Assuming false represents empty parking
                               // Add other properties if needed
                           };
                            oModel.update("/ParkingslotsSet('" + temp + "')",  updatedParkingLot, {
                                success: function () {
                                    sap.m.MessageBox.success(`Reserved Vehicle ${oSelectedRow.Vehicleno} assigned successfully to plot ${oSelectedRow.Parkinglot}.`);
                                    oModel.refresh();
                                }, error: function () {
                                    sap.m.MessageBox.error("Unable to Update");
                                }

                            })

                const accountSid = "ACfcd333bcb3dc2c2febd267ce455a6762"
                const authToken = "687323f325394ff3b30f44a83444c2b2"
 
                // debugger
                const toNumber = `+91${oSelectedRow.Phonenumber}`
                const fromNumber = '+13613109079';
                const messageBody = `Hello ${oSelectedRow.Drivername},Your vehicle with Vehicle number ${oSelectedRow.Vehicleno} is allocated to the Slot ${oSelectedRow.Parkinglot}.`;
 
 
                // Twilio API endpoint for sending messages
                const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
 
 
                // Send POST request to Twilio API using jQuery.ajax
                $.ajax({
                    url: url,
                    type: 'POST',
                    async: true,
                    headers: {
                        'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken)
                    },
                    data: {
                        To: toNumber,
                        From: fromNumber,
                        Body: messageBody
                    },
                    success: function (data) {
                        MessageToast.show('if number exists SMS will be sent!');
                    },
                    error: function (error) {
                        MessageToast.show('Failed to send SMS: ' + error);
                    }
                });
                        },
                        error: function (oError) {
                            sap.m.MessageBox.error("Failed to update : " + oError.message);
                        }

                    })

                },
                error: function (oError) {
                    sap.m.MessageBox.error("Failed to update : " + oError.message);
                }
            })

        },
        // FOR PIE CHART
        _setParkingLotModel: function () {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            oModel.read("/ParkingslotsSet", {
                success: function (oData) {
                    console.log("Fetched Data:", oData);
                    var aItems = oData.results;
                    var availableCount = aItems.filter(item => item.Status === "AVAILABLE").length;
                    var occupiedCount = aItems.filter(item => item.Status === "Occupied").length;
                    var reserveCount = aItems.filter(item => item.Status === "RESERVED").length;


                    var aChartData = {
                        Items: [
                            {
                                Status: "AVAILABLE",
                                Count: availableCount,
                                Status:`AVAILABLE - ${availableCount}`
                            },
                            {
                                Status: "Occupied",
                                Count: occupiedCount,
                                Status:`Occupied - ${occupiedCount}`
                            },
                            {
                                Status: "RESERVED",
                                Count: reserveCount,  
                                Status:`RESERVED - ${reserveCount}`
                              }
                        ]
                    };
                    var oParkingLotModel = new JSONModel();
                    oParkingLotModel.setData(aChartData);
                    that.getView().setModel(oParkingLotModel, "ParkingLotModel");
                },
                error: function (oError) {
                    console.error(oError);
                }
            });
        },
        // when you click on assign it should print along the details
        printAssignmentDetails: function () {
            debugger
            // Fetch values from the view
            var currentDateTime = new Date();
            var formattedDate = currentDateTime.toLocaleDateString();
            var formattedTime = currentDateTime.toLocaleTimeString();
            var sSlotNumber = this.byId("idparkingLotSelect").getSelectedKey();
            var sVehicleNumber = this.byId("idvehiclenoInput12").getValue();
            var sVehicleType = this.byId("idselectvt").getSelectedKey();
            var sDriverNumber = this.byId("driverPhoneInput").getValue();
            var sDriverName = this.byId("driverNameInput").getValue();
           
     
            // Create a new window for printing
            var printWindow = window.open('', '', 'height=600,width=800');
     
            // Write HTML content to the print window
            printWindow.document.write('<html><head><title>Print Receipt</title>');
            printWindow.document.write('<style>');
            printWindow.document.write('body { font-family: Arial, sans-serif; margin: 20px; }');
            printWindow.document.write('.details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }');
            printWindow.document.write('.details-table th, .details-table td { border: 1px solid #000; padding: 8px; text-align: left; }');
            printWindow.document.write('.details-table th { background-color: #f2f2f2; }');
            printWindow.document.write('.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }');
            printWindow.document.write('.date-time { flex-grow: 1; }');
            printWindow.document.write('.qr-code { margin-right: 50px; }');
            printWindow.document.write('.truck-image { text-align: center; margin-top: 20px; }');
            printWindow.document.write('.logo { position: absolute; top: 20px; right: 20px; }');
            printWindow.document.write('.Dummy { padding:1rem; }');
            printWindow.document.write('</style>');
            printWindow.document.write('</head><body>');
     
            // Add the logo to the top right corner
            printWindow.document.write('<div class="logo">');
            printWindow.document.write('<img src="https://artihcus.com/assets/img/AG-logo.png" height="50"/>'); // Reduced size
            printWindow.document.write('</div>');
            printWindow.document.write('<div class="Dummy">');
            printWindow.document.write('<div class="Dummy">');
            printWindow.document.write('</div>');
     
            printWindow.document.write('<div class="title">');
            printWindow.document.write('<h1>Parking Lot Allocation Slip:</h1>');
            printWindow.document.write('</div>');
            printWindow.document.write('<div class="header">');
            printWindow.document.write('<div class="date-time">');
            printWindow.document.write('<p><strong>Date:</strong> ' + formattedDate + '</p>');
            printWindow.document.write('<p><strong>Time:</strong> ' + formattedTime + '</p>');
            printWindow.document.write('</div>');
            printWindow.document.write('<div class="qr-code" id="qrcode"></div>');
            printWindow.document.write('</div>');
            printWindow.document.write('<table class="details-table">');
            printWindow.document.write('<tr><th>Property</th><th>Details</th></tr>');
            printWindow.document.write('<tr><td>Slot Number</td><td>' + sSlotNumber + '</td></tr>');
            printWindow.document.write('<tr><td>Vehicle Number</td><td>' + sVehicleNumber + '</td></tr>');
            printWindow.document.write('<tr><td>Vehicle Type</td><td>' + sVehicleType + '</td></tr>');
            printWindow.document.write('<tr><td>Driver Phone Number</td><td>' + sDriverNumber + '</td></tr>');
            printWindow.document.write('<tr><td>Driver Name</td><td>' + sDriverName + '</td></tr>');
            // printWindow.document.write('<tr><td>Delivery Type</td><td>' + sServiceType + '</td></tr>');
            printWindow.document.write('</table>');
            printWindow.document.write('<div class="truck-image">');
            printWindow.document.write('</div>');
     
            // Close document and initiate QR code generation
            printWindow.document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>');
            printWindow.document.write('<script>');
            printWindow.document.write('setTimeout(function() {');
            printWindow.document.write('new QRCode(document.getElementById("qrcode"), {');
            printWindow.document.write('text: "' + sVehicleNumber + '",'); // QR code contains vehicle number
            printWindow.document.write('width: 100,');
            printWindow.document.write('height: 100');
            printWindow.document.write('});');
            printWindow.document.write('}, 1000);'); // Adjust the timeout for QR code rendering
            printWindow.document.write('</script>');
     
            // Close document
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
     
            // Wait for QR code to be fully rendered before printing
            setTimeout(function () {
              printWindow.print();
            }, 1500); // Timeout to ensure the QR code is rendered before printing
          },
        //conform button in vendor requests page
        onConformbtn: async function () {
            var oSelected = this.byId("idRequest").getSelectedItem();
            if (oSelected) {
                var oSelectedObject = oSelected.getBindingContext().getObject();
                var oServiceType = oSelectedObject.Processtype;

                // Create and set a JSON model to store the selected item details
                const oConfirmRequestModel = new sap.ui.model.json.JSONModel({
                    Vendorname: oSelectedObject.Vendorname,
                    Vendorphno: oSelectedObject.Vendorphno,
                    Drivername: oSelectedObject.Drivername,
                    Phonenumber: oSelectedObject.Phonenumber,
                    Vehicletype: oSelectedObject.Vehicletype,
                    Vehicleno: oSelectedObject.Vehicleno,
                    Processtype: oServiceType,
                    Reservedtime: oSelectedObject.Reservedtime
                });
                this.getView().setModel(oConfirmRequestModel, "oConfirmRequestModel");

                // Load the dialog fragment if not already loaded
                if (!this.oDialog) {
                    this.oDialog = await Fragment.load({
                        id: this.getView().getId(),
                        name: "com.app.yardmanagement.Fragments.AcceptDailog",
                        controller: this
                    });
                    this.getView().addDependent(this.oDialog);
                }

                var oModel = this.getOwnerComponent().getModel();
                var oThis = this;
                // Fetch all slots data
                oModel.read("/ParkingslotsSet", {
                    success: function (oData) {
                        // Filter available slots based on Service Type
                        var aFilteredSlots = oData.results.filter(function (slot) {
                            return slot.Status === "AVAILABLE" && slot.Processtype === oServiceType;
                        });

                        // Get the ComboBox control
                        var oComboBox = oThis.byId("idselectSlotReserve");
                        // Clear existing items from ComboBox
                        oComboBox.removeAllItems();
                        // Add filtered slots to the ComboBox
                        aFilteredSlots.forEach(function (slot) {
                            oComboBox.addItem(new sap.ui.core.ListItem({
                                key: slot.Parkinglot,
                                text: slot.Parkinglot
                            }));
                        });
                        // Open the dialog
                        oThis.oDialog.open();
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to load slot data.");
                    }
                });
            } else {
                // Show a message if no vendor is selected
                sap.m.MessageToast.show("Please Select a Vendor to Confirm A Slot Reservation..!");
            }
        },
        onCloseDialog: function() {
            if (this.oDialog.isOpen()) {
                this.oDialog.close();
            }
         },

         //dailog box reserve button
         onReserveSlotBtnPress: async function () {

            debugger;

            const svendorName = this.getView().byId("InputVedorname12").getValue();
            const svendorphno = this.getView().byId("InputVedorphno12").getValue();
            const svehicleNo = this.getView().byId("InputVehicleno12").getValue();
            const sdriverName = this.getView().byId("InputDriverName12").getValue();
            const sphoneNumber = this.getView().byId("InputPhonenumber12").getValue();
            const svehicleType = this.getView().byId("InputVehicletype12").getValue();
            const sProcessType = this.getView().byId("InputProcesstype12").getValue();
            const sReservedDate = this.getView().byId("InputEstimatedtime12").getValue();

            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
            });
 
            var currentDate = new Date(); // Current system date and time
            var formattedDateTime = oDateFormat.format(currentDate);
 
            const oReserveModel = new JSONModel({

                Reservations: {

                    Vendorname: svendorName,
                    Vendorphno:svendorphno,
                    Vehicleno: svehicleNo,
                    Drivername: sdriverName,
                    Phonenumber: sphoneNumber,
                    Processtype: sProcessType,
                    Vehicletype: svehicleType,
                    Reservedtime: formattedDateTime,
                    Parkinglot: "",
                }
            });
            this.getView().setModel(oReserveModel, "reserveModel");
            const oPayload = this.getView().byId("page7").getModel("reserveModel").getProperty("/");
            const oModel = this.getView().byId("pageContainer").getModel();
            const plotNo = this.getView().byId("idselectSlotReserve").getValue();
            oPayload.Reservations.Parkinglot = plotNo;

            var orow = this.byId("idRequest").getSelectedItem().getBindingContext().getPath();
            try {
                // Assuming createData method sends a POST request
                await this.createData(oModel, oPayload.Reservations, "/RESERVATIONSSet");
                
                const updatedParkingLot = {
                     Parkinglot: plotNo,
                     Status: "RESERVED", // Assuming false represents empty parking
                     Processtype:sProcessType // Assuming false represents empty parking
                    // Add other properties if needed
                };

                //Update parking lot entity
                oModel.update("/ParkingslotsSet('" + plotNo + "')", updatedParkingLot, {
                    success: function () { 

                        oModel.remove(orow, {
                            success: function () { 
                                oModel.refresh()
                                sap.m.MessageToast.show(`${svehicleNo} Reserved to Slot No ${plotNo}`);
                            },
                            error: function() {

                            }

                        })
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to update: " + oError.message);
                    }
                });

                //   start SMS
                const accountSid = "ACfcd333bcb3dc2c2febd267ce455a6762"
                const authToken = "687323f325394ff3b30f44a83444c2b2"
 
                // debugger
                const toNumber = `+91${svendorphno}`
                const fromNumber = '+13613109079';
                const messageBody = `Hello, ${svendorName} your vehicle with vehicle number:${svehicleNo}  is allocated to slot number:${plotNo}.`;
 
 
                // Twilio API endpoint for sending messages
                const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
 
 
                // Send POST request to Twilio API using jQuery.ajax
                $.ajax({
                    url: url,
                    type: 'POST',
                    async: true,
                    headers: {
                        'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken)
                    },
                    data: {
                        To: toNumber,
                        From: fromNumber,
                        Body: messageBody
                    },
                    success: function (data) {
                        MessageToast.show('if number exists SMS will be sent!');
                    },
                    error: function (error) {
                        MessageToast.show('Failed to send SMS: ' + error);
                    }
                });


                this.oDialog.close();

            } catch (error) {
                console.error("Error:", error);
            }
             
            this.onclearPress12();
            this.oDialog.close();
 
        },
        onNotificationPress: async function (oEvent) {
            var oButton = oEvent.getSource(),
                oView = this.getView();
            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.yardmanagement.Fragments.Notifications",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    oPopover.setModel(oModel);
                    return oPopover;
                });
            }
            this._pPopover.then(function (oPopover) {
                oPopover.openBy(oButton);
            });
            var oModel = this.getOwnerComponent().getModel();
            this.getView().byId("idnotificationDialog").setModel(oModel)
        },
       
        onModel: async function () {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;
            await oModel.read("/VENDORRESERVATIONSet", {
                success: function (oData) {
                    var t = oData.results.length;
                    that.byId("idnotificationsbadge").setValue(t);
                },
                error: function () {
                }
            })

            oModel.refresh()
        },
        onBeforeRendering: function () {
            this.onModel();

        },
        onAfterRendering: function () {
            this.onModel();
        },
            //search option in Allocated slots
            onSearch12: async function (oEvent) {
                var sQuery = oEvent.getParameter("newValue").trim();
                var oTable = this.byId("idAllocatedSlots"); // ID of your Table
            
                try {
                    var oModel = this.getOwnerComponent().getModel(); // Assuming the model is bound to the view
                    var sPath = "/VDEATILSSet"; // Your EntitySet path
            
                    // Fetch the data from the OData service
                    var aAllData = await new Promise((resolve, reject) => {
                        oModel.read(sPath, {
                            success: function (oData) {
                                resolve(oData.results);
                            },
                            error: function (oError) {
                                console.error("Failed to fetch all data:", oError);
                                reject(oError);
                            }
                        });
                    });
            
                    // If there's a search query, filter the data based on the query
                    var aFilteredData;
                    if (sQuery) {
                        aFilteredData = aAllData.filter(function (oItem) {
                            return (oItem.Parkinglot && oItem.Parkinglot.includes(sQuery)) ||
                                (oItem.Vehicleno && oItem.Vehicleno.includes(sQuery)) ||
                                (oItem.Intime && oItem.Intime.includes(sQuery)) ||
                                (oItem.Vehicletype && oItem.Vehicletype.includes(sQuery)) ||
                                (oItem.Processtype && oItem.Processtype.includes(sQuery)) ||
                                (oItem.Drivername && oItem.Drivername.includes(sQuery)) ||
                                (oItem.Phonenumber && oItem.Phonenumber.includes(sQuery));
                        });
                    } else {
                        aFilteredData = aAllData; // No search query, use all data
                    }
            
                    // Create a new JSON model with the filtered data
                    var oFilteredModel = new sap.ui.model.json.JSONModel(aFilteredData);
            
                    // Bind the filtered model to the table
                    oTable.setModel(oFilteredModel);
                    oTable.bindItems({
                        path: "/",
                        template: oTable.getBindingInfo("items").template
                    });
            
                } catch (error) {
                    console.error("Error fetching or filtering data:", error);
                }
            },
            //search functionality in Reserved slots 
            onSearch: async function (oEvent) {
                var sQuery = oEvent.getParameter("newValue").trim();
                var oTable = this.byId("idReserved"); // ID of your Table
                
                try {
                    var oModel = this.getOwnerComponent().getModel(); // Assuming the model is bound to the view
                    var sPath = "/RESERVATIONSSet"; // Your EntitySet path
                    
                    // Fetch the data from the OData service
                    var aAllData = await new Promise((resolve, reject) => {
                        oModel.read(sPath, {
                            success: function (oData) {
                                resolve(oData.results);
                            },
                            error: function (oError) {
                                console.error("Failed to fetch all data:", oError);
                                reject(oError);
                            }
                        });
                    });
            
                    // If there's a search query, filter the data based on the query
                    var aFilteredData;
                    if (sQuery) {
                        aFilteredData = aAllData.filter(function (oItem) {
                            return (oItem.Vendorname && oItem.Vendorname.includes(sQuery)) ||
                                (oItem.Vendorphno && oItem.Vendorphno.includes(sQuery)) ||
                                (oItem.Vehicleno && oItem.Vehicleno.includes(sQuery)) ||
                                (oItem.Drivername && oItem.Drivername.includes(sQuery)) ||
                                (oItem.Phonenumber && oItem.Phonenumber.includes(sQuery)) ||
                                (oItem.Vehicletype && oItem.Vehicletype.includes(sQuery)) ||
                                (oItem.Parkinglot && oItem.Parkinglot.includes(sQuery)) ||
                                (oItem.Reservedtime && oItem.Reservedtime.includes(sQuery));
                        });
                    } else {
                        aFilteredData = aAllData; // No search query, use all data
                    }
            
                    // Create a new JSON model with the filtered data
                    var oFilteredModel = new sap.ui.model.json.JSONModel(aFilteredData);
            
                    // Bind the filtered model to the table
                    oTable.setModel(oFilteredModel);
                    oTable.bindItems({
                        path: "/",
                        template: oTable.getBindingInfo("items").template
                    });
            
                } catch (error) {
                    console.error("Error fetching or filtering data:", error);
                }
            },
            //search functionality in Vendor requests
            onSearchV: async function (oEvent) {
                var sQuery = oEvent.getParameter("newValue").trim();
                var oTable = this.byId("idRequest"); // ID of your Table
                
                try {
                    var oModel = this.getOwnerComponent().getModel(); // Assuming the model is bound to the view
                    var sPath = "/VENDORRESERVATIONSet"; // Your EntitySet path
                    
                    // Fetch the data from the OData service
                    var aAllData = await new Promise((resolve, reject) => {
                        oModel.read(sPath, {
                            success: function (oData) {
                                resolve(oData.results);
                            },
                            error: function (oError) {
                                console.error("Failed to fetch all data:", oError);
                                reject(oError);
                            }
                        });
                    });
            
                    // If there's a search query, filter the data based on the query
                    var aFilteredData;
                    if (sQuery) {
                        aFilteredData = aAllData.filter(function (oItem) {
                            return (oItem.Vendorname && oItem.Vendorname.includes(sQuery)) ||
                                (oItem.Vendorphno && oItem.Vendorphno.includes(sQuery)) ||
                                (oItem.Vehicleno && oItem.Vehicleno.includes(sQuery)) ||
                                (oItem.Drivername && oItem.Drivername.includes(sQuery)) ||
                                (oItem.Phonenumber && oItem.Phonenumber.includes(sQuery)) ||
                                (oItem.Vehicletype && oItem.Vehicletype.includes(sQuery)) ||
                                (oItem.Processtype && oItem.Processtype.includes(sQuery)) ||
                                (oItem.Reservedtime && oItem.Reservedtime.includes(sQuery));
                        });
                    } else {
                        aFilteredData = aAllData; // No search query, use all data
                    }
            
                    // Create a new JSON model with the filtered data
                    var oFilteredModel = new sap.ui.model.json.JSONModel(aFilteredData);
            
                    // Bind the filtered model to the table
                    oTable.setModel(oFilteredModel);
                    oTable.bindItems({
                        path: "/",
                        template: oTable.getBindingInfo("items").template
                    });
            
                } catch (error) {
                    console.error("Error fetching or filtering data:", error);
                }
            },
            //search functionality in ALLSLOTS
            onSearchALL: async function (oEvent) {
                var sQuery = oEvent.getParameter("newValue").trim();
                var oTable = this.byId("idAllSlots"); // ID of your Table
            
                try {
                    var oModel = this.getOwnerComponent().getModel(); // Assuming the model is bound to the view
                    var sPath = "/ParkingslotsSet"; // Your EntitySet path
            
                    // Fetch the data from the OData service
                    var aAllData = await new Promise((resolve, reject) => {
                        oModel.read(sPath, {
                            success: function (oData) {
                                resolve(oData.results);
                            },
                            error: function (oError) {
                                console.error("Failed to fetch all data:", oError);
                                reject(oError);
                            }
                        });
                    });
            
                    // If there's a search query, filter the data based on the query
                    var aFilteredData;
                    if (sQuery) {
                        aFilteredData = aAllData.filter(function (oItem) {
                            return (oItem.Parkinglot && oItem.Parkinglot.includes(sQuery)) ||
                                (oItem.Processtype && oItem.Processtype.includes(sQuery)) ||
                                (oItem.Status && oItem.Status.includes(sQuery));
                        });
                    } else {
                        aFilteredData = aAllData; // No search query, use all data
                    }
            
                    // Create a new JSON model with the filtered data
                    var oFilteredModel = new sap.ui.model.json.JSONModel(aFilteredData);
            
                    // Bind the filtered model to the table
                    oTable.setModel(oFilteredModel);
                    oTable.bindItems({
                        path: "/",
                        template: oTable.getBindingInfo("items").template
                    });
            
                } catch (error) {
                    console.error("Error fetching or filtering data:", error);
                }
            },
            //search functionality in history
            onSearchH: async function (oEvent) {
                var sQuery = oEvent.getParameter("newValue").trim();
                var oTable = this.byId("idHistory"); // ID of your Table
            
                try {
                    var oModel = this.getOwnerComponent().getModel(); // Assuming the model is bound to the view
                    var sPath = "/historySet"; // Your EntitySet path
            
                    // Fetch the data from the OData service
                    var aAllData = await new Promise((resolve, reject) => {
                        oModel.read(sPath, {
                            success: function (oData) {
                                resolve(oData.results);
                            },
                            error: function (oError) {
                                console.error("Failed to fetch all data:", oError);
                                reject(oError);
                            }
                        });
                    });
            
                    // If there's a search query, filter the data based on the query
                    var aFilteredData;
                    if (sQuery) {
                        aFilteredData = aAllData.filter(function (oItem) {
                            return (oItem.Vehicleno && oItem.Vehicleno.includes(sQuery)) ||
                                (oItem.Drivername && oItem.Drivername.includes(sQuery)) ||
                                (oItem.Phonenumber && oItem.Phonenumber.includes(sQuery)) ||
                                (oItem.Processtype && oItem.Processtype.includes(sQuery)) ||
                                (oItem.Vehicletype && oItem.Vehicletype.includes(sQuery)) ||
                                (oItem.Parkinglot && oItem.Parkinglot.includes(sQuery)) ||
                                (oItem.Intime && oItem.Intime.includes(sQuery)) ||
                                (oItem.Outtime && oItem.Outtime.includes(sQuery));
                        });
                    } else {
                        aFilteredData = aAllData; // No search query, use all data
                    }
            
                    // Create a new JSON model with the filtered data
                    var oFilteredModel = new sap.ui.model.json.JSONModel(aFilteredData);
            
                    // Bind the filtered model to the table
                    oTable.setModel(oFilteredModel);
                    oTable.bindItems({
                        path: "/",
                        template: oTable.getBindingInfo("items").template
                    });
            
                } catch (error) {
                    console.error("Error fetching or filtering data:", error);
                }
            },
            onRejectReservePress: function () {
                debugger
                const oThis = this
                var oModel = this.getOwnerComponent().getModel();
                const oSelected = this.getView().byId("idRequest").getSelectedItem(),
                //sUUId = oSelected.getBindingContext().getObject().Uuid,
                sDriverName = oSelected.getBindingContext().getObject().Drivername,
                    sDriverMobile = oSelected.getBindingContext().getObject().Phonenumber,
                    svehicleNo = oSelected.getBindingContext().getObject().Vehicleno,
                    sVendorphno = oSelected.getBindingContext().getObject().Vendorphno;
 
                oModel.remove(`/VENDORRESERVATIONSet('${svehicleNo}')`, {
                    success: function () {
 
                        MessageBox.information("Request rejected sucessfully")

                        //   start SMS
                const accountSid = "ACfcd333bcb3dc2c2febd267ce455a6762"
                const authToken = "687323f325394ff3b30f44a83444c2b2"
 
                // debugger
                const toNumber = `+91${sVendorphno}`
                const fromNumber = '+13613109079';
                const messageBody = `Hi ${sDriverName},\n\nYour vehicle with registration number ${svehicleNo} is rejected `;
 
 
                // Twilio API endpoint for sending messages
                const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
 
 
                // Send POST request to Twilio API using jQuery.ajax
                $.ajax({
                    url: url,
                    type: 'POST',
                    async: true,
                    headers: {
                        'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken)
                    },
                    data: {
                        To: toNumber,
                        From: fromNumber,
                        Body: messageBody
                    },
                    success: function (data) {
                        MessageToast.show('if number exists SMS will be sent!');
                    },
                    error: function (error) {
                        MessageToast.show('Failed to send SMS: ' + error);
                    }
                });
 
                // sms endR
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to reject the request: " + oError.message);
                    }
                }) 
            },

    });
});
