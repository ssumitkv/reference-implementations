const fs = require("fs");
const _ = require("lodash");
const dao = require("../../dao/dao");
const constants = require("../constants");
const utils = require("../utils");
const { checkContext } = require("../../services/service");
const validateSchema = require("../schemaValidation");

const checkOnSearch = (dirPath, msgIdSet) => {
  let onSrchObj = {};

  try {
    let onSearch = fs.readFileSync(dirPath + `/${constants.RET_ONSEARCH}.json`);
    onSearch = JSON.parse(onSearch);
    try {
      console.log(`Validating Schema for ${constants.RET_ONSEARCH} API`);
      const vs = validateSchema("retail", constants.RET_ONSEARCH, onSearch);
      if (vs != "error") {
        // console.log(vs);
        Object.assign(onSrchObj, vs);
      }
    } catch (error) {
      console.log(
        `!!Error occurred while performing schema validation for /${constants.RET_ONSEARCH}`,
        error
      );
    }

    try {
      console.log(`Storing BAP_ID and BPP_ID in /${constants.RET_ONSEARCH}`);
      dao.setValue("bapId", onSearch.context.bap_id);
      dao.setValue("bppId", onSearch.context.bpp_id);
    } catch (error) {
      console.log(
        `!!Error while storing BAP and BPP Ids in /${constants.RET_ONSEARCH}`,
        error
      );
    }

    try {
      console.log(`Checking context for ${constants.RET_ONSEARCH} API`);
      res = checkContext(onSearch.context, constants.RET_ONSEARCH);
      if (!res.valid) {
        Object.assign(onSrchObj, res.ERRORS);
      }
    } catch (error) {
      console.log(
        `Some error occurred while checking /${constants.RET_ONSEARCH} context`,
        error
      );
    }

    try {
      console.log(
        `Comparing city of /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH}`
      );
      if (!_.isEqual(dao.getValue("city"), onSearch.context.city)) {
        onSrchObj.city = `City code mismatch in /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH}`;
      }
    } catch (error) {
      console.log(
        `Error while comparing city in /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH}`,
        error
      );
    }

    try {
      console.log(
        `Comparing timestamp of /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH}`
      );
      const tmpstmp = dao.getValue("tmpstmp");
      if (_.gte(tmpstmp, onSearch.context.timestamp)) {
        onSrchObj.tmpstmp = `Context timestamp for /${constants.RET_SEARCH} api cannot be greater than or equal to /${constants.RET_ONSEARCH} api`;
      } else {
        const timeDiff = utils.timeDiff(onSearch.context.timestamp, tmpstmp);
        console.log(timeDiff);
        if (timeDiff > 5000) {
          onSrchObj.tmpstmp = `context/timestamp difference between /${constants.RET_ONSEARCH} and /${constants.RET_SEARCH} should be smaller than 5 sec`;
        }
      }

      dao.setValue("tmpstmp", onSearch.context.timestamp);
    } catch (error) {
      console.log(
        `Error while comparing timestamp for /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH} api`
      );
    }

    try {
      console.log(
        `Comparing transaction Ids of /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH}`
      );
      if (!_.isEqual(dao.getValue("txnId"), onSearch.context.transaction_id)) {
        onSrchObj.txnId = `Transaction Id for /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH} api should be same`;
      }
      // dao.setValue("txnId", onSearch.context.transaction_id);
    } catch (error) {
      console.log(
        `Error while comparing transaction ids for /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH} api`,
        error
      );
    }

    try {
      console.log(
        `Comparing Message Ids of /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH}`
      );
      if (!_.isEqual(dao.getValue("msgId"), onSearch.context.message_id)) {
        onSrchObj.msgId = `Message Id for /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH} api should be same`;
      }
      msgIdSet.add(onSearch.context.message_id);
    } catch (error) {
      console.log(
        `Error while comparing message ids for /${constants.RET_SEARCH} and /${constants.RET_ONSEARCH} api`,
        error
      );
    }

    onSearch = onSearch.message.catalog;
    let onSearchFFIds = new Set();
    let prvdrsId = new Set();

    try {
      console.log(
        `Saving static fulfillment ids in /${constants.RET_ONSEARCH}`
      );

      let i = 0;
      const bppFF = onSearch["bpp/fulfillments"];
      const len = bppFF.length;
      while (i < len) {
        onSearchFFIds.add(bppFF[i].id);
        i++;
      }
    } catch (error) {
      console.log(
        `Error while saving static fulfillment ids in /${constants.RET_ONSEARCH}`,
        error
      );
    }

    try {
      console.log(
        `Checking Providers info (bpp/providers) in /${constants.RET_ONSEARCH}`
      );
      let i = 0;
      const bppPrvdrs = onSearch["bpp/providers"];
      const len = bppPrvdrs.length;
      const tmpstmp = dao.getValue("tmpstmp");
      while (i < len) {
        let itemsId = new Set();
        let prvdrLocId = new Set();
        let ctgryId = new Set();

        console.log(
          `Validating uniqueness for provider id in bpp/providers[${i}]...`
        );
        let prvdr = bppPrvdrs[i];

        if (prvdrsId.has(prvdr.id)) {
          const key = `prvdr${i}id`;
          onSrchObj[
            key
          ] = `duplicate provider id: ${prvdr.id} in bpp/providers`;
        } else {
          prvdrsId.add(prvdr.id);
        }

        console.log(
          `Checking store enable/disable timestamp in bpp/providers[${i}]`
        );
        if (!_.isEqual(prvdr.time.timestamp, tmpstmp)) {
          onSrchObj.storeEnblDsbl = `store enable/disable timestamp (/bpp/providers/time/timestamp) must match context.timestamp`;
        }
        console.log(`Checking store timings in bpp/providers[${i}]`);

        prvdr.locations.forEach((loc, iter) => {
          if (prvdrLocId.has(loc.id)) {
            const key = `prvdr${i}${loc.id}${iter}`;
            onSrchObj[
              key
            ] = `duplicate location id: ${loc.id} in /bpp/providers[${i}]/locations[${iter}]`;
          } else {
            prvdrLocId.add(loc.id);
          }

          console.log("Checking store days...");
          const days = loc.time.days.split(",");
          days.forEach((day) => {
            day = parseInt(day);
            if (isNaN(day) || day < 1 || day > 7) {
              const key = `prvdr${i}locdays${iter}`;
              onSrchObj[
                key
              ] = `store days (bpp/providers[${i}]/locations[${iter}]/time/days) should be in the format ("1,2,3,4,5,6,7") where 1- Monday and 7- Sunday`;
            }
          });

          console.log("Checking fixed or split timings");
          //scenario 1: range =1 freq/times =1
          if (
            loc.time.range &&
            (loc.time.schedule.frequency || loc.time.schedule.times)
          ) {
            const key = `prvdr${i}loctime${iter}`;
            onSrchObj[
              key
            ] = `Either one of fixed (range) or split (frequency and times) timings should be provided in /bpp/providers[${i}]/locations[${iter}]/time`;
          }
          // scenario 2: range=0 freq || times =1
          if (
            !loc.time.range &&
            (!loc.time.schedule.frequency || !loc.time.schedule.times)
          ) {
            const key = `prvdr${i}loctime${iter}`;
            onSrchObj[
              key
            ] = `Either one of fixed timings (range) or split timings (both frequency and times) should be provided in /bpp/providers[${i}]/locations[${iter}]/time`;
          }

          //scenario 3: range=1 (start and end not compliant) frequency=0;
          if ("range" in loc.time) {
            console.log("checking range (fixed timings) start and end");
            const startTime =
              "start" in loc.time.range ? parseInt(loc.time.range.start) : "";
            const endTime =
              "end" in loc.time.range ? parseInt(loc.time.range.end) : "";
            if (
              isNaN(startTime) ||
              isNaN(endTime) ||
              startTime > endTime ||
              endTime > 2359
            ) {
              onSrchObj.startEndTime = `end time must be greater than start time in fixed timings /locations/time/range (fixed store timings)`;
            }
          }
        });

        try {
          console.log(
            `Checking items for provider (${prvdr.id}) in bpp/providers[${i}]`
          );
          let j = 0;
          const items = onSearch["bpp/providers"][i]["items"];
          const iLen = items.length;
          while (j < iLen) {
            console.log(
              `Validating uniqueness for item id in bpp/providers[${i}].items[${j}]...`
            );
            let item = items[j];

            if (itemsId.has(item.id)) {
              const key = `prvdr${i}item${j}`;
              onSrchObj[
                key
              ] = `duplicate item id: ${item.id} in bpp/providers[${i}]`;
            } else {
              itemsId.add(item.id);
            }

            console.log(
              `Checking available and maximum count for item id: ${item.id}`
            );
            if ("available" in item.quantity && "maximum" in item.quantity) {
              const avlblCnt = parseInt(item.quantity.available.count);
              const mxCnt = parseInt(item.quantity.maximum.count);

              if (avlblCnt > mxCnt) {
                const key = `prvdr${i}item${j}Cnt`;
                onSrchObj[
                  key
                ] = `available count of item should be smaller or equal to the maximum count (/bpp/providers[${i}]/items[${j}]/quantity)`;
              }
            }

            console.log(
              `Checking selling price and maximum price for item id: ${item.id}`
            );

            if ("price" in item) {
              const sPrice = parseFloat(item.price.value);
              const maxPrice = parseFloat(item.price.maximum_value);

              if (sPrice > maxPrice) {
                const key = `prvdr${i}item${j}Price`;
                onSrchObj[
                  key
                ] = `selling price of item /price/value with id: (${item.id}) can't be greater than the maximum price /price/maximum_value in /bpp/providers[${i}]/items[${j}]/`;
              }
            }

            console.log(`Checking category_id for item id: ${item.id}`);
            if ("category_id" in item) {
              ctgryId.add(item.category_id);
            }

            console.log(`Checking fulfillment_id for item id: ${item.id}`);

            if (!onSearchFFIds.has(item.fulfillment_id)) {
              const key = `prvdr${i}item${j}ff`;
              onSrchObj[
                key
              ] = `fulfillment_id in /bpp/providers[${i}]/items[${j}] should map to one of the fulfillments id in bpp/fulfillments`;
            }

            console.log(`Checking location_id for item id: ${item.id}`);

            if (!prvdrLocId.has(item.location_id)) {
              const key = `prvdr${i}item${j}loc`;
              onSrchObj[
                key
              ] = `location_id in /bpp/providers[${i}]/items[${j}] should be one of the locations id in /bpp/providers[${i}]/locations`;
            }

            console.log(
              `Checking consumer care details for item id: ${item.id}`
            );
            if ("@ondc/org/contact_details_consumer_care" in item) {
              let consCare = item["@ondc/org/contact_details_consumer_care"];
              consCare = consCare.split(",");
              checkEmail = utils.emailRegex(consCare[1].trim());
              if (isNaN(consCare[2].trim()) || !checkEmail) {
                const key = `prvdr${i}consCare`;
                onSrchObj[
                  key
                ] = `@ondc/org/contact_details_consumer_care should be in the format "name,email,contactno" in /bpp/providers[${i}]/items`;
              }
            }
            j++;
          }
        } catch (error) {
          console.log(
            `!!Errors while checking items in bpp/providers[${i}]`,
            error
          );
        }

        try {
          console.log(
            `Checking serviceability construct for bpp/providers[${i}]`
          );

          const tags = onSearch["bpp/providers"][i]["tags"];
          //checking for each serviceability construct
          tags.forEach((sc, t) => {
            if ("list" in sc) {
              if (sc.list.length != 5) {
                const key = `prvdr${i}tags${t}`;
                onSrchObj[
                  key
                ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract`;
              }

              //checking location
              const loc =
                sc.list.find((elem) => elem.code === "location") || "";
              if (!loc) {
                const key = `prvdr${i}tags${t}loc`;
                onSrchObj[
                  key
                ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (location is missing)`;
              } else {
                if ("value" in loc) {
                  if (!prvdrLocId.has(loc.value)) {
                    const key = `prvdr${i}tags${t}loc`;
                    onSrchObj[
                      key
                    ] = `location in serviceability construct should be one of the location ids bpp/providers[${i}]/locations`;
                  }
                } else {
                  const key = `prvdr${i}tags${t}loc`;
                  onSrchObj[
                    key
                  ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (location is missing)`;
                }
              }

              //checking category
              const ctgry =
                sc.list.find((elem) => elem.code === "category") || "";
              if (!ctgry) {
                const key = `prvdr${i}tags${t}ctgry`;
                onSrchObj[
                  key
                ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (category is missing)`;
              } else {
                if ("value" in ctgry) {
                  if (!ctgryId.has(ctgry.value)) {
                    const key = `prvdr${i}tags${t}ctgry`;
                    onSrchObj[
                      key
                    ] = `category in serviceability construct should be one of the category ids bpp/providers[${i}]/items/category_id`;
                  }
                } else {
                  const key = `prvdr${i}tags${t}ctgry`;
                  onSrchObj[
                    key
                  ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (category is missing)`;
                }
              }

              //checking type (hyperlocal, intercity or PAN India)
              const type = sc.list.find((elem) => elem.code === "type") || "";
              if (!type) {
                const key = `prvdr${i}tags${t}type`;
                onSrchObj[
                  key
                ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (type is missing)`;
              } else {
                if ("value" in type) {
                  switch (type.value) {
                    case "10":
                      {
                        //For hyperlocal

                        //checking value
                        const val =
                          sc.list.find((elem) => elem.code === "val") || "";
                        if ("value" in val) {
                          if (isNaN(val.value)) {
                            const key = `prvdr${i}tags${t}valvalue`;
                            onSrchObj[
                              key
                            ] = `value should be a number (code:"val") for type 10 (hyperlocal) in /bpp/providers[${i}]/tags[${t}]`;
                          }
                        } else {
                          const key = `prvdr${i}tags${t}val`;
                          onSrchObj[
                            key
                          ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (value is missing for code "val")`;
                        }

                        //checking unit
                        const unit =
                          sc.list.find((elem) => elem.code === "unit") || "";
                        if ("value" in unit) {
                          if (unit.value != "km") {
                            const key = `prvdr${i}tags${t}unitvalue`;
                            onSrchObj[
                              key
                            ] = `value should be "km" (code:"unit") for type 10 (hyperlocal) in /bpp/providers[${i}]/tags[${t}]`;
                          }
                        } else {
                          const key = `prvdr${i}tags${t}unit`;
                          onSrchObj[
                            key
                          ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (value is missing for code "unit")`;
                        }
                      }

                      break;
                    case "11":
                      {
                        //intercity

                        //checking value
                        const val =
                          sc.list.find((elem) => elem.code === "val") || "";
                        if ("value" in val) {
                          const pincodes = val.value.split(/,|-/);
                          pincodes.forEach((pincode) => {
                            if (isNaN(pincode) || pincode.length != 6) {
                              const key = `prvdr${i}tags${t}valvalue`;
                              onSrchObj[
                                key
                              ] = `value should be a valid range of pincodes (code:"val") for type 11 (intercity) in /bpp/providers[${i}]/tags[${t}]`;
                            }
                          });
                        } else {
                          const key = `prvdr${i}tags${t}val`;
                          onSrchObj[
                            key
                          ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (value is missing for code "val")`;
                        }

                        //checking unit
                        const unit =
                          sc.list.find((elem) => elem.code === "unit") || "";
                        if ("value" in unit) {
                          if (unit.value != "pincode") {
                            const key = `prvdr${i}tags${t}unitvalue`;
                            onSrchObj[
                              key
                            ] = `value should be "pincode" (code:"unit") for type 11 (intercity) in /bpp/providers[${i}]/tags[${t}]`;
                          }
                        } else {
                          const key = `prvdr${i}tags${t}unit`;
                          onSrchObj[
                            key
                          ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (value is missing for code "unit")`;
                        }
                      }

                      break;
                    case "12":
                      {
                        //PAN India

                        //checking value
                        const val =
                          sc.list.find((elem) => elem.code === "val") || "";
                        if ("value" in val) {
                          if (val.value != "IND") {
                            const key = `prvdr${i}tags${t}valvalue`;
                            onSrchObj[
                              key
                            ] = `value should be "IND" (code:"val") for type 12 (PAN India) in /bpp/providers[${i}]tags[${t}]`;
                          }
                        } else {
                          const key = `prvdr${i}tags${t}val`;
                          onSrchObj[
                            key
                          ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (value is missing for code "val")`;
                        }

                        //checking unit
                        const unit =
                          sc.list.find((elem) => elem.code === "unit") || "";
                        if ("value" in unit) {
                          if (unit.value != "country") {
                            const key = `prvdr${i}tags${t}unitvalue`;
                            onSrchObj[
                              key
                            ] = `value should be "country" (code:"unit") for type 12 (PAN India) in /bpp/providers[${i}]tags[${t}]`;
                          }
                        } else {
                          const key = `prvdr${i}tags${t}unit`;
                          onSrchObj[
                            key
                          ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (value is missing for code "unit")`;
                        }
                      }

                      break;
                    default: {
                      const key = `prvdr${i}tags${t}type`;
                      onSrchObj[
                        key
                      ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (invalid type "${type.value}")`;
                    }
                  }
                } else {
                  const key = `prvdr${i}tags${t}type`;
                  onSrchObj[
                    key
                  ] = `serviceability construct /bpp/providers[${i}]/tags[${t}] should be defined as per the API contract (type is missing)`;
                }
              }
            }
          });
        } catch (error) {
          console.log(
            `!!Error while checking serviceability construct for bpp/providers[${i}]`,
            error
          );
        }

        i++;
      }
    } catch (error) {
      console.log(
        `!!Error while checking Providers info in /${constants.RET_ONSEARCH}`,
        error
      );
    }

    dao.setValue("onSearch", onSearch);
    console.log(onSrchObj);
    dao.setValue("onSrchObj", onSrchObj);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`!!File not found for ${constants.RET_ONSEARCH} API!`);
    } else {
      console.log(
        `!!Some error occurred while checking /${constants.RET_ONSEARCH} API`
      );
    }
  }
};

module.exports = checkOnSearch;
