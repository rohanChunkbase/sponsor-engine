# Venue booking prices

This text uses ASD-STE100 Simplified Technical English.

The package gives a price for one venue booking.
The currency is GBP.
GBP means pounds sterling.
The package reads the past bookings of that venue.
A community pays less than a company.
A community can pay nothing.

WARNING: DO NOT USE THE SAMPLE PRICES FOR A REAL VENUE. THE FILE `data/sample-bookings.csv` IS NOT REAL. THE VENUE NAME RIVERWORKS HALL IS NOT REAL. THIS FILE IS NOT A NIGHT OFFICE EXPORT.

## Interface

Call `quotePrice(request, history)`.
The function returns these fields:

- `price`: the quote in GBP
- `currency`: the text `GBP`
- `range`: `low` and `high`, in GBP
- `explanation`: plain text for a person
- `market`: this quote next to published London rooms of a similar size
- `comparables`: the past bookings that support the quote

The explanation is plain language.
The explanation is not in Simplified Technical English.
The explanation tells you these facts:

- The difference between a community price and a company price
- The reason for this price
- The past bookings that support the price
- The community discount, or the fact that there is no community discount
- One sentence that places the quote next to published London rooms

The request has these fields:

| Field | Meaning |
| --- | --- |
| `date` | Calendar date, `YYYY-MM-DD` |
| `isEvening` | `true` when the booking is an evening |
| `isWeekend` | `true` when the booking uses the weekend price |
| `hours` | Duration in hours |
| `headcount` | Number of people |
| `bookerType` | `community`, `startup`, `company`, or `agency` |
| `repeatBookerCount` | Count of earlier bookings by this booker |
| `broughtLeads` | `true` when the booker brings new leads |
| `avNeeds` | `true` when the booking needs AV |
| `cateringNeeds` | `true` when the booking needs catering |

AV means audio and visual equipment.
Examples are microphones and a projector.

```ts
import { loadBookingsFile, quotePrice } from '@sponsor-engine/pricing';

const history = loadBookingsFile('night-office-redacted.csv');
const quote = quotePrice(
  {
    date: '2026-11-12',
    isEvening: true,
    isWeekend: false,
    hours: 4,
    headcount: 80,
    bookerType: 'community',
    repeatBookerCount: 6,
    broughtLeads: true,
    avNeeds: true,
    cateringNeeds: false,
  },
  history,
);
```

Redacted means the venue removed private names before the export.

## Run the package

1. Go to the directory `packages/pricing`.
2. Run `npm install`.
3. Run `npm test`.
4. Run `npm run evaluate`.
5. Read the MAE and the MAPE.
6. Read the three example quotes.

`npm run generate` writes the SAMPLE file again.
The seed is `20261022`.
The same seed writes the same 300 rows.

## Use a real venue file

You can replace the SAMPLE file with a real venue CSV.
CSV means a text table.
Commas separate the columns.
Night Office can use a redacted history with these columns.
One file is for one venue.
Do not mix two venues in one file.

1. Export the venue history to a CSV file.
2. Use the column names in the table below.
3. Call `loadBookingsFile` with the file path.
4. Call `quotePrice` with the request and the bookings.
5. Read `price`, `range`, and `explanation`.

The history must contain at least 10 bookings.

## Columns

| Column | Required | Values |
| --- | --- | --- |
| `date` | yes | `YYYY-MM-DD` |
| `is_evening` | yes | `y` or `n` |
| `is_weekend` | yes | `y` or `n` |
| `hours` | yes | Number greater than 0 |
| `headcount` | yes | Whole number, 1 or more |
| `booker_type` | yes | `community`, `startup`, `company`, `agency` |
| `repeat_booker_count` | yes | Whole number, 0 or more |
| `brought_leads` | yes | `y` or `n` |
| `av_needs` | yes | `y` or `n` |
| `catering_needs` | yes | `y` or `n` |
| `price_paid_gbp` | yes | 0 or more |
| `free_community_slot` | yes | `y` or `n` |
| `booking_id` | no | Text id. The quote shows this id. |
| `data_label` | no | `SAMPLE`, `REAL`, `REDACTED`, or empty |
| `venue_name` | no | Name of the venue |
| `weekday` | no | English weekday. It must match `date`. |
| `booker_alias` | no | Fictional or redacted booker id |

A free community slot must have `booker_type` `community`.
A free community slot must have `price_paid_gbp` `0`.
A community row with price `0` must have `free_community_slot` `y`.

You can use one column named `timing` in place of the two flag columns.
Use `weekday-day`, `weekday-evening`, `weekend-day`, or `weekend-evening`.

You can use one column named `av_catering` in place of the two service columns.
Use `none`, `av`, `catering`, or `both`.

The loader also accepts some other header text.
`Price Paid (GBP)` is the same column as `price_paid_gbp`.
`Booker Type` is the same column as `booker_type`.
A line that starts with `#` is a comment.
The loader ignores other columns.

## SAMPLE history

The generator writes 300 bookings for one fictional London room.
The room name is Riverworks Hall (SAMPLE).
Each row has `data_label` `SAMPLE`.
The first date is 2024-10-01.
The last date is 2026-09-30.

The file has these booker counts:

- Community: 168
- Startup: 60
- Agency: 42
- Company: 30

Communities book often.
Companies book once.
Every company row has `repeat_booker_count` `0`.
The highest `repeat_booker_count` in the file is 42.
That row is a community row.

Communities use weekday evenings.
In this file, 88 percent of community rows are evenings.
13 percent of community rows are weekend rows.
Companies use weekday day hours.
In this file, 10 percent of company rows are evenings.
7 percent of company rows are weekend rows.

A community brings leads more often than a company.
In this file, 67 percent of community rows have `brought_leads` `y`.
13 percent of company rows have `brought_leads` `y`.

The generator gives August a low date weight.
The generator gives 20 December to 31 December a low date weight.
The generator gives October a high date weight.
Across the two years, the file has 20 bookings in August.
Across the two years, the file has 18 bookings in December.
Across the two years, the file has 33 bookings in October.

`is_weekend` is `y` on Saturday and on Sunday in the SAMPLE file.
A real file can set `is_weekend` from the venue rules.
The loader does not force `is_weekend` to match the calendar.

## SAMPLE price rules

The quote function does not read this tariff.
The generator uses this tariff to make the fictional prices.
If you change the tariff, change this section too.

The generator makes the room hire from an hour price.

| Hours | Hour price (GBP) |
| --- | --- |
| Weekday day | 150 |
| Weekday evening | 220 |
| Weekend day | 200 |
| Weekend evening | 280 |

Room hire = hour price × hours.

The generator adds a people fee:

| People | Fee (GBP) |
| --- | --- |
| 1 to 70 | 0 |
| 71 to 110 | 250 |
| 111 to 160 | 550 |
| 161 or more | 900 |

The AV fee is £240 when `av_needs` is `y`.
The AV fee is £0 when `av_needs` is `n`.

The generator multiplies the room hire, the people fee, and the AV fee by a booker factor:

| Booker | Factor |
| --- | --- |
| community | 0.18 |
| startup | 0.50 |
| agency | 0.90 |
| company | 1 |

Each past booking removes 2.5 percent of that hire.
The maximum repeat discount is 15 percent.

When `brought_leads` is `y`, the generator also removes this share of the hire:

| Booker | Lead discount |
| --- | --- |
| community | 55 percent |
| startup | 10 percent |
| agency | 4 percent |
| company | 4 percent |

The generator then adds a catering fee per person.
The discounts do not change the catering fee.

| Booker | Catering (GBP per person) |
| --- | --- |
| community | 0 |
| startup | 9 |
| agency | 10 |
| company | 10 |

A community catering fee is £0.
A sponsor pays the food vendor.
The venue does not put that food cost in `price_paid_gbp`.

A community slot is free when `brought_leads` is `y` and one of these is true:

- `hours` is 5 or less, and `headcount` is 110 or less
- `repeat_booker_count` is 8 or more

A community slot is also free when the price before noise is £100 or less.
A startup slot is never free.
An agency slot is never free.
A company slot is never free.

The generator then changes each paid price by plus or minus 4 percent.
5 percent of paid rows also change by plus or minus 12 percent.
That second change is a manual price.
The generator rounds the result to the nearest £5.
A price of £0 stays £0.
A startup, an agency, or a company pays at least £50 after rounding.

The file has 109 free community slots.
The median is the middle price after you sort the prices.
The median community price is £0.
The median price for a community that paid is £170.
The median startup price is £1,260.
The median agency price is £1,330.
The median company price is £1,745.

A company pays the rack hour price.
The company factor is 1.
An older factor of 1.75 put a company day above the published London band.
Company catering is £10 per person.
An agency pays 0.90 of the rack hour price.
Agency catering is £10 per person.
A company pays more than an agency for the same booking.

A company weekday evening of 4 hours for 80 people, with AV and with no catering, is £1,370.
That price is inside the published band of £400 to £3,200.
The median of that band is £1,350.
Every company row in the SAMPLE file is inside £400 to £3,200.
The SAMPLE price can include more than 4 hours.
The SAMPLE price can include catering.
The market column is the room hire for about 4 evening hours.

## London market check

The file `data/london_venue_market.csv` lists public London venue hire prices.
Each row has a source URL.
The column `gbp_per_4h_evening_norm` is the price of one evening of about 4 hours.
VAT is not adjusted.
A pub row that gives only a minimum spend has no price in that column.
`marketCheck` does not use those rows.
`marketCheck` does not use Somerset House River Terrace or Tobacco Dock Little Gallery.
Those two rooms are much larger and much more expensive than the other rooms.
The other 20 evening prices run from £400 to £3,200.
Sort those 20 prices.
The two middle prices are £1,300 and £1,400.
The median is £1,350.

Call `marketCheck(quote, capacity)`.
`quote` is a price in GBP.
`capacity` is the number of people.
The function keeps rooms with a capacity near that number.
The result has these fields:

- `percentile`: the share of those rooms with a published price at or below the quote
- `comparedCount`: the number of rooms in that comparison
- `low` and `high`: the lowest and highest prices among the three nearest rooms
- `nearest`: three rooms, each with `name`, `price`, `url`, and `capacity`

A percentile of 0 means the quote is below every similar room.
A percentile of 100 means the quote is at or above every similar room.

`quotePrice` puts this result in `market`.
The explanation contains one sentence of this shape:

`A company evening for 80 here is £1,545; similar London rooms publish £960 to £1,100 (Runway East Aldgate, Second Home Spitalfields).`

The names and the prices in that example are an illustration.
The real sentence uses the three nearest rooms for the request.
When the request is not an evening of 3 to 5 hours, the sentence adds `for about 4 evening hours`.
The market column is a 4-hour evening hire.
A longer booking is a different product.

## How the quote is calculated

The package fits two methods on the past bookings.
The package scores the two methods on held-out rows.
The package uses the method with the lower error.

kNN means k nearest neighbors.
k is the count of past bookings.
Here k is 8.
The nearest-booking method finds the 8 nearest past bookings with the same booker type.
The method takes a weighted median of those prices.
The median is weighted by similarity.
A nearer booking has a higher weight.
When fewer than 3 bookings of that type exist, the method uses the nearest bookings of any type.

The free-slot rule can set the price to £0.
All of these must be true:

- The booker is a community.
- The booker brings leads.
- At least half of those nearest bookings were free slots.

The method then rounds the price to the nearest £5.

The second method is a gradient boosted model.
The model adds many small decision trees.
The trees learn the logarithm of (1 + price).
A logarithm makes a large price smaller on the scale that the trees see.
The quote converts the tree result back to GBP.
The quote rounds that price to the nearest £5.
The package chooses the tree count on the last 15 percent of the fit rows, in date order.
The score fits the trees on the first 240 rows.
That fit uses 45 trees.
The quote fits the trees on all 300 rows.
That fit uses 42 trees.
Each new tree uses a step size of 0.08.

MAE means mean absolute error.
MAE is the mean of the absolute price errors, in GBP.
MAPE means mean absolute percentage error.
MAPE is the mean of the absolute percentage errors.
MAPE uses only rows with a price above £0.
A free slot has no percentage.

The split sorts the bookings by date, then by booking id.
The fit uses the first 80 percent of the rows.
The score uses the last 20 percent of the rows.
The SAMPLE score uses 240 rows for the fit and 60 rows for the score.
The quote for a new request fits the winner on every row in the history.
The MAE does not use that full fit.
The MAE uses the held-out split only.

The winner is the method with the lower MAE.
When the MAE values are equal, the winner is the method with the lower MAPE.
When those values are also equal, the winner is the nearest-booking method.
A constant median is a baseline.
The median cannot win.
The package uses MAE as the primary score.
One pound has the same weight for every booking.
MAPE gives a small community price a high weight, and MAPE ignores £0.

## Result on the SAMPLE file

`npm run evaluate` prints these scores.
The values below are the printed values.

| Method | MAE | MAPE on 37 paid rows | Free slots at £0 | Paid rows at £0 |
| --- | --- | --- | --- | --- |
| Nearest bookings | £67.75 | 16.2 percent | 22 of 23 | 0 |
| Gradient boosted trees (winner) | £63.42 | 12.0 percent | 22 of 23 | 0 |
| Median baseline | £539.08 | 69.2 percent | 0 of 23 | 0 |

The gradient boosted model wins on MAE.
The gradient boosted model also has the lower MAPE.
The quote uses the gradient boosted model.

The three example requests are not in the history.
The dates are after 2026-09-30.
The fit for these quotes uses all 300 SAMPLE rows.

| Request | Price | Range |
| --- | --- | --- |
| Community 80-person evening hack | £0 | £0 to £0 |
| Startup launch | £1,645 | £1,430 to £1,800 |
| Corporate offsite | £1,705 | £1,690 to £1,920 |

The community request is an evening on 2026-11-12 for 80 people and 4 hours.
The booker has 6 past bookings and brings leads.
The community discount is a free slot.
The startup request is an evening on 2026-11-19 for 100 people and 4 hours.
The startup needs AV and catering.
There is no community discount.
The company request is a day booking on 2026-11-18 for 45 people and 8 hours.
The company needs AV and catering.
The company pays the full price.
The company price is inside the published London band.

The market sentences for these three quotes are:

- A community evening for 80 here is £0; similar London rooms publish £960 to £1,600 (Runway East Aldgate East (AE Event Space), Sustainable Ventures (County Hall) (The View)).
- A startup evening for 100 here is £1,645; similar London rooms publish £1,300 to £2,000 (Huckletree Liverpool Street (The Common), Second Home Spitalfields (The Rooftop)).
- A company day for 45 here is £1,705; similar London rooms publish £600 to £2,000 for about 4 evening hours (Plexal (Bleachers Space), Fora 241 Southwark Bridge Road (The Point)).

## Limits

The model can only repeat patterns that are in the history.
Do not send a booker type that is not in the column list.
MAPE does not include a price of £0.
The explanation rounds MAE to the nearest pound.
The evaluation script prints MAE with two decimal places.

## Licence

The licence is MIT.
Read the file `LICENSE`.
